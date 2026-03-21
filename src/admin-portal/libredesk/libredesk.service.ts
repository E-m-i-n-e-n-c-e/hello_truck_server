import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AdminFirebaseService } from '../firebase/admin-firebase.service';
import {
  AdminRole,
  VerificationRequestStatus,
  VerificationStatus
} from '@prisma/client';
import { ACTIVE_VERIFICATION_REQUEST_STATUSES } from '../verification/utils/verification.constants';
import { AdminNotificationEvent } from '../types/admin-notification.types';
import { LibredeskWebhookPayload, LibredeskAgent, LibredeskConversation } from './libredesk.types';

@Injectable()
export class LibredeskService {
  private readonly baseUrl: string;
  private readonly authHeader: any;
  private readonly webhookSecret: string;
  private readonly inboxId: number;
  private readonly logger = new Logger(LibredeskService.name);

  // In-memory cache variables
  private cachedAgents: LibredeskAgent[] | null = null;
  private lastAgentsFetch = 0;
  private readonly CACHE_TTL_MS = 60_000;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private firebaseService: AdminFirebaseService,
  ) {
    this.baseUrl = `${this.configService.get<string>('LIBREDESK_API_URL')}/api/v1`;
    const apiKey = this.configService.get<string>('LIBREDESK_API_KEY');
    const apiSecret = this.configService.get<string>('LIBREDESK_API_SECRET');
    const credentials = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');

    this.webhookSecret = this.configService.get<string>('LIBREDESK_WEBHOOK_SECRET', '');
    this.inboxId = this.configService.get<number>('LIBREDESK_INBOX_ID', 0);

    this.authHeader = {
      Authorization: `Basic ${credentials}`,
    };
  }

  /**
   * Fetches agents with a 1-minute in-memory cache
   */
  private async getAgents(forceRefresh = false): Promise<LibredeskAgent[] | null> {
    const now = Date.now();

    if (forceRefresh || !this.cachedAgents || now - this.lastAgentsFetch > this.CACHE_TTL_MS) {
      try {
        const res = await axios.get(`${this.baseUrl}/agents`, {
          headers: this.authHeader,
        });
        let agents: LibredeskAgent[] = res.data?.data || res.data;

        this.cachedAgents = agents;
        this.lastAgentsFetch = now;
      } catch (error) {
        this.logger.error('Failed to get agents from Libredesk API', error);
        throw error;
      }
    }

    return this.cachedAgents;
  }

  /**
   * Fetches a conversation by UUID from Libredesk API
   */
  private async getConversation(uuid: string): Promise<LibredeskConversation | null> {
    try {
      const res = await axios.get(`${this.baseUrl}/conversations/${uuid}`, {
        headers: this.authHeader,
        timeout: 10000,
      });
      
      const conversation = res.data?.data || res.data;
      return conversation;
    } catch (error) {
      this.logger.error(`Failed to get conversation ${uuid} from Libredesk API`, error);
      return null;
    }
  }

  /**
   * Raw API call to assign a conversation to an agent ID
   */
  private async setConversationAssignee(ticketId: string, assigneeId: number) {
    try {
      await axios.put(
        `${this.baseUrl}/conversations/${ticketId}/assignee/user`,
        { assignee_id: assigneeId },
        {
          headers: {
            ...this.authHeader,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );
    } catch (error) {
      this.logger.error(`Failed to assign conversation ${ticketId} to agent ${assigneeId} via API`, error);
      throw error;
    }
  }

  /**
   * Public API: Assigns a Libredesk conversation to an agent by email.
   * Runs asynchronously in the background (fire-and-forget).
   */
  assignConversation(ticketId: string, email: string) {
    if (!ticketId) {
      this.logger.warn(`No ticketId provided for Libredesk assignment via email: ${email}`);
      return;
    }

    // Fire-and-forget execution
    this.assignAsync(ticketId, email);
  }

  private async assignAsync(ticketId: string, email: string) {
    try {
      let agents = await this.getAgents();

      if (!agents || !Array.isArray(agents)) {
        this.logger.error('Failed to parse Libredesk agents list from API');
        return;
      }

      // Find an active agent matching the email
      let agent = agents.find(
        (a) => a.email && a.email.toLowerCase() === email.toLowerCase() && a.enabled !== false
      );

      // If not found, bypass cache and try once more before failing
      if (!agent) {
        this.logger.log(`Agent ${email} not found in cache. Forcing agents refresh...`);
        agents = await this.getAgents(true);

        if (agents && Array.isArray(agents)) {
          agent = agents.find(
            (a) => a.email && a.email.toLowerCase() === email.toLowerCase() && a.enabled !== false
          );
        }
      }

      if (!agent) {
        this.logger.warn(`Libredesk agent not found or disabled, cannot assign: ${email}`);
        return;
      }

      await this.setConversationAssignee(ticketId, agent.id);

      this.logger.log(`Assigned Libredesk conversation ${ticketId} to agent ${email} (ID: ${agent.id})`);
    } catch (err) {
      this.logger.error(`Libredesk assignment failed for conversation ${ticketId} to ${email}`, err);
    }
  }

  /**
   * Webhook Handler: Handle Libredesk webhook events.
   */
  async handleWebhook(payload: LibredeskWebhookPayload, signature: string) {
    this.logger.log(JSON.stringify(payload));
    
    // 1. Verify signature if secret is configured
    if (this.webhookSecret) {
      if (!signature) throw new UnauthorizedException('Missing Libredesk signature header');

      const rawBody = JSON.stringify(payload);
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(rawBody)
        .digest('hex');

      if (signature !== `sha256=${expectedSignature}`) {
        this.logger.error('Invalid Libredesk webhook signature');
        throw new UnauthorizedException('Invalid Libredesk signature');
      }
    }

    // 2. Handle specific events
    if (payload.event === 'conversation.assigned') {
      const { conversation_uuid, assigned_to, conversation } = payload.payload;

      // If conversation object is not in payload (minimal payload), fetch it
      let conversationData: LibredeskConversation | null = conversation;
      if (!conversationData) {
        this.logger.log(`Webhook: Minimal payload received, fetching conversation ${conversation_uuid}`);
        conversationData = await this.getConversation(conversation_uuid);
        
        if (!conversationData) {
          this.logger.error(`Failed to fetch conversation ${conversation_uuid} from Libredesk API`);
          return { success: true, ignored: true, reason: 'conversation_fetch_failed' };
        }
      }

      // Check inbox_id matches our configured inbox
      if (conversationData.inbox_id !== this.inboxId) {
        this.logger.log(`Libredesk webhook: Ignoring assignment for different inbox (${conversationData.inbox_id} vs ${this.inboxId})`);
        return { success: true, ignored: true, reason: 'unmatched_inbox' };
      }

      // Find the agent's email
      let agents = await this.getAgents();
      if (!agents || !Array.isArray(agents)) {
        return { success: true, ignored: true, reason: 'agents_list_unavailable' };
      }

      let agent = agents.find((a) => a.id === assigned_to);

      // If not found in cache, force refresh once
      if (!agent) {
        this.logger.log(`Webhook syncing: Agent ID ${assigned_to} not in cache. Refreshing...`);
        agents = await this.getAgents(true);
        if (agents && Array.isArray(agents)) {
          agent = agents.find((a) => a.id === assigned_to);
        }
      }

      if (!agent || !agent.email) {
        this.logger.warn(`Libredesk Webhook: Assigned agent ${assigned_to} not found`);
        return { success: true, ignored: true, reason: 'agent_not_found' };
      }

      // Sync assignment to our system
      await this.assignByTicketId(conversation_uuid, agent.email);
    }

    return { success: true };
  }

  /**
   * Internal logic to assign a verification request system-side based on ticket ID.
   * This logic is copied and tweaked from AdminVerificationService to avoid circular dependency.
   */
  private async assignByTicketId(ticketId: string, email: string) {
    try {
      const verification = await this.prisma.driverVerificationRequest.findFirst({
        where: { ticketId },
        include: { driver: true, assignedTo: true }
      });

      if (!verification) {
        this.logger.warn(`Libredesk webhook: Verification not found with ticketId ${ticketId}`);
        return;
      }

      if (!ACTIVE_VERIFICATION_REQUEST_STATUSES.includes(verification.status)) {
        this.logger.warn(`Libredesk webhook: Verification ${verification.id} not active`);
        return;
      }

      if (verification.assignedTo?.email?.toLowerCase() === email.toLowerCase()) {
        this.logger.log("Already assigned to the same person")
        return; // Already matched
      }

      const assignee = await this.prisma.adminUser.findUnique({
        where: { email: email.trim().toLowerCase() }
      });

      if (!assignee || !assignee.isActive) return;

      const allowedRoles = [AdminRole.ADMIN, AdminRole.AGENT, AdminRole.FIELD_AGENT, AdminRole.SUPER_ADMIN];
      if (!allowedRoles.includes(assignee.role as any)) {
        return;
      }

      const beforeSnapshot = {
        verificationId: verification.id,
        assignedToId: verification.assignedToId,
        assignedToEmail: verification.assignedTo?.email ?? null,
        status: verification.status,
      };

      const updated = await this.prisma.driverVerificationRequest.update({
        where: { id: verification.id },
        data: {
          assignedToId: assignee.id,
          status: verification.status === VerificationRequestStatus.PENDING
              ? VerificationRequestStatus.IN_REVIEW
              : verification.status,
        }
      });

      const afterSnapshot = {
        verificationId: updated.id,
        assignedToId: updated.assignedToId,
        assignedToEmail: assignee.email,
        status: updated.status,
      };

      // Notify new assignee in our dashboard
      await this.prisma.adminNotification.create({
        data: {
          userId: assignee.id,
          title: 'New verification assigned',
          message: `You have been assigned a verification request for ${verification.driver.firstName ?? ''} ${verification.driver.lastName ?? ''}`.trim(),          
          entityId: updated.id,
          entityType: 'VERIFICATION',
          driverId: verification.driver.id,
          actionUrl: `/verifications/request/${updated.id}`,
        },
      });

      // Create audit log for webhook assignment (fire-and-forget, best effort)
      this.prisma.auditLog.create({
        data: {
          userId: null,
          role: AdminRole.SUPER_ADMIN,
          actionType: 'VERIFICATION_ASSIGNED',
          module: 'VERIFICATION',
          description: `Verification ${verification.id} assigned to ${assignee.email} via Libredesk webhook`,
          beforeSnapshot: beforeSnapshot as any,
          afterSnapshot: afterSnapshot as any,
          entityId: verification.id,
          entityType: 'VERIFICATION_REQUEST',
        },
      }).catch((error) => {
        this.logger.error(`Failed to create audit log for webhook assignment: ${error.message}`);
      });

      // Send Push Notification
      this.firebaseService
        .notifyAdminSessions(assignee.id, {
          notification: {
            title: 'New Verification Assigned',
            body: `You have been assigned verification in Libredesk for driver ${verification.driver.firstName ?? ''} ${verification.driver.lastName ?? ''}`.trim(),
          },
          data: {
            event: AdminNotificationEvent.VERIFICATION_ASSIGNED,
            entityId: updated.id,
            entityType: 'VERIFICATION',
            driverId: verification.driver.id,
            actionUrl: `/verifications/request/${updated.id}`,
          },
        })
        .catch((e) => this.logger.error(`Failed to notify ${assignee.id}`, e));

      this.logger.log(`Libredesk Webhook: Synced Verification ${updated.id} assignment to ${assignee.email}`);
    } catch (error) {
      this.logger.error(`Failed to assign by ticket ID ${ticketId}`, error);
    }
  }
}

