/**
 * Audit Log Interceptor
 *
 * Automatically logs actions from ALL admin portal users after successful responses.
 * This includes: Super Admin, Admin, Agent, Field Agent, and Customer Support.
 * Uses metadata to determine what to log.
 *
 * Supports two modes for capturing snapshots:
 * 1. Standard: Captures request/response as-is (captureRequest/captureResponse)
 * 2. Enhanced: Services return { data, __auditMetadata } with before/after snapshots (captureSnapshots)
 *
 * Usage:
 * @AuditLog({ action: 'DOCUMENT_APPROVED', module: 'VERIFICATION', captureSnapshots: true })
 */
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { AuditLogService } from './audit-log.service';
import { AUDIT_LOG_KEY, AuditLogMetadata, AUDIT_METADATA_KEY } from './decorators/audit-log.decorator';
import { AdminJwtPayload } from '../auth/admin-auth.service';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    private readonly auditLogService: AuditLogService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const auditMetadata = this.reflector.get<AuditLogMetadata>(
      AUDIT_LOG_KEY,
      context.getHandler(),
    );

    // If no @AuditLog decorator, skip logging
    if (!auditMetadata) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const user: AdminJwtPayload | undefined = request.user;

    // Capture before state if needed (standard mode)
    const beforeSnapshot = auditMetadata.captureRequest
      ? { params: request.params, body: request.body }
      : undefined;

    return next.handle().pipe(
      tap((response) => {
        // For login endpoint, extract user from response since request.user doesn't exist yet
        let logUserId = user?.sub;
        let logUserRole = user?.role;

        // Special handling for LOGIN action - extract from response
        if (auditMetadata.action === 'LOGIN' && response && typeof response === 'object') {
          const loginResponse = response as any;
          if (loginResponse.user) {
            logUserId = loginResponse.user.id;
            logUserRole = loginResponse.user.role;
          }
        }

        // Only log if we have a user ID (either from auth or from login response)
        if (!logUserId || !logUserRole) return;

        // Build description
        let description = auditMetadata.description || `${auditMetadata.action} action performed`;

        // Replace placeholders in description
        if (request.params.id) {
          description = description.replace(':id', request.params.id);
        }
        if (request.params.field) {
          description = description.replace(':field', request.params.field);
        }

        // Extract entity info and snapshots
        let entityId = request.params.id || request.params.driverId || request.params.bookingId;
        let beforeSnapshotData = beforeSnapshot;
        let afterSnapshotData = auditMetadata.captureResponse ? response : undefined;

        // If enhanced snapshots were provided by service, check for audit metadata
        if (auditMetadata.captureSnapshots && response && typeof response === 'object') {
          const snapshotMetadata = (response as any)[AUDIT_METADATA_KEY];
          if (snapshotMetadata) {
            if (snapshotMetadata.beforeSnapshot) {
              beforeSnapshotData = snapshotMetadata.beforeSnapshot;
            }
            if (snapshotMetadata.afterSnapshot) {
              afterSnapshotData = snapshotMetadata.afterSnapshot;
            }
            if (snapshotMetadata.entityId) {
              entityId = snapshotMetadata.entityId;
            }
          }
        }

        const entityType = auditMetadata.entityType;

        // Determine actual action type (for dynamic actions like document approval/rejection)
        let actionType = auditMetadata.action;

        // Special handling for document actions - check request body for actual action
        if (request.body?.action === 'APPROVED') {
          actionType = 'DOCUMENT_APPROVED';
        } else if (request.body?.action === 'REJECTED') {
          actionType = 'DOCUMENT_REJECTED';
        }

        // Log asynchronously (don't await)
        this.auditLogService.log({
          userId: logUserId,
          role: logUserRole,
          actionType,
          module: auditMetadata.module,
          description,
          ipAddress: request.ip || request.headers['x-forwarded-for'],
          userAgent: request.headers['user-agent'],
          beforeSnapshot: beforeSnapshotData,
          afterSnapshot: afterSnapshotData,
          entityId,
          entityType,
        }).catch((err) => {
          console.error('Failed to create audit log:', err);
        });
      }),
    );
  }
}
