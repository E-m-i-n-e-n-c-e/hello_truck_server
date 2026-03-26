import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminRefundStatus, AdminRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SupportQueueService } from './support-queue.service';
import { AUDIT_METADATA_KEY } from '../../audit-log/decorators/audit-log.decorator';
import { AuditActionTypes, AuditLogService, AuditModules } from '../../audit-log/audit-log.service';
import { AdminNotificationsService } from '../../notifications/admin-notifications.service';
import { AdminNotificationEvent } from '../../types/admin-notification.types';
import { AdminFirebaseService } from '../../firebase/admin-firebase.service';
import { FcmEventType } from '../../types/fcm.types';
import { BookingRefundService } from '../../../booking/services/booking-refund.service';
import { EDITABLE_REFUND_REQUEST_STATUSES } from '../utils/support.constants';
import { toDecimal, toNumber, truncateDecimal } from '../utils/decimal.utils';

@Injectable()
export class AdminSupportService {
  private readonly logger = new Logger(AdminSupportService.name);
  private readonly bufferDurationMinutes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly supportQueue: SupportQueueService,
    private readonly auditLog: AuditLogService,
    private readonly notificationsService: AdminNotificationsService,
    private readonly firebaseService: AdminFirebaseService,
    private readonly bookingRefundService: BookingRefundService,
  ) {
    // TODO:
    // this.bufferDurationMinutes = this.configService.get<number>('ADMIN_BUFFER_DURATION_MINUTES', 60);
    this.bufferDurationMinutes = 1;
  }

  async approveRefund(refundId: string, approverId: string, approverRole: AdminRole) {
    this.assertAdminRole(approverRole);

    const refund = await this.prisma.adminRefundRequest.findUnique({
      where: { id: refundId },
      include: {
        booking: {
          select: { bookingNumber: true },
        },
        customer: {
          select: { id: true },
        },
      },
    });

    if (!refund) {
      throw new NotFoundException('Refund request not found');
    }
    if (!EDITABLE_REFUND_REQUEST_STATUSES.includes(refund.status)) {
      throw new BadRequestException('Refund cannot be approved in its current status');
    }

    const bufferExpiresAt = new Date(Date.now() + this.bufferDurationMinutes * 60 * 1000);

    const updatedRefund = await this.prisma.adminRefundRequest.update({
      where: { id: refundId },
      data: {
        status: AdminRefundStatus.APPROVED,
        approvedById: approverId,
        approvedAt: new Date(),
        bufferExpiresAt,
        rejectionReason: null,
        revertReason: null,
        revertRequestedById: null,
        revertRequestedAt: null,
      },
      include: {
        booking: {
          select: { bookingNumber: true },
        },
      },
    });

    await this.supportQueue.scheduleRefundFinalization(refundId, bufferExpiresAt);

    this.notificationsService
      .sendNotification(
        {
          title: 'Refund approved',
          message: `Refund approved for Booking #${updatedRefund.booking.bookingNumber.toString()}`,
          entityId: refundId,
          entityType: 'REFUND',
          actionUrl: `/support/refunds/${refundId}`,
        },
        {
          userId: refund.createdById,
          event: AdminNotificationEvent.REFUND_REVERT_DECISION,
        },
      )
      .catch((error) => {
        this.logger.error(`Failed to notify refund creator ${refund.createdById}`, error);
      });

    this.firebaseService
      .notifyAllSessions(
        refund.customerId,
        'customer',
        {
          notification: {
            title: 'Refund Approved',
            body: `Your refund for Booking #${refund.booking.bookingNumber.toString()} has been approved.`,
          },
          data: {
            event: FcmEventType.RefundCreated,
            refundId,
            status: AdminRefundStatus.APPROVED,
          },
        },
        this.prisma,
      )
      .catch((error) => {
        this.logger.error(`Failed to notify customer ${refund.customerId} about refund approval`, error);
      });

    return {
      ...updatedRefund,
      bufferDurationMinutes: this.bufferDurationMinutes,
      [AUDIT_METADATA_KEY]: {
        beforeSnapshot: {
          refundId,
          status: refund.status,
          bufferExpiresAt: refund.bufferExpiresAt,
        },
        afterSnapshot: {
          refundId,
          status: updatedRefund.status,
          bufferExpiresAt,
        },
        entityId: refundId,
      },
    };
  }

  async rejectRefund(refundId: string, reason: string, rejectorId: string, rejectorRole: AdminRole) {
    this.assertAdminRole(rejectorRole);

    const refund = await this.prisma.adminRefundRequest.findUnique({
      where: { id: refundId },
    });

    if (!refund) {
      throw new NotFoundException('Refund request not found');
    }
    if (!EDITABLE_REFUND_REQUEST_STATUSES.includes(refund.status)) {
      throw new BadRequestException('Refund cannot be rejected in its current status');
    }

    const updatedRefund = await this.prisma.adminRefundRequest.update({
      where: { id: refundId },
      data: {
        status: AdminRefundStatus.REJECTED,
        rejectionReason: reason,
        bufferExpiresAt: null,
      },
    });

    await this.supportQueue.cancelRefundFinalization(refundId);

    this.notificationsService
      .sendNotification(
        {
          title: 'Refund rejected',
          message: 'A refund request you created was rejected.',
          entityId: refundId,
          entityType: 'REFUND',
          actionUrl: `/support/refunds/${refundId}`,
        },
        {
          userId: refund.createdById,
          event: AdminNotificationEvent.REFUND_REVERT_DECISION,
        },
      )
      .catch((error) => {
        this.logger.error(`Failed to notify refund creator ${refund.createdById}`, error);
      });

    return {
      ...updatedRefund,
      [AUDIT_METADATA_KEY]: {
        beforeSnapshot: {
          refundId,
          status: refund.status,
          rejectionReason: refund.rejectionReason,
        },
        afterSnapshot: {
          refundId,
          status: updatedRefund.status,
          rejectionReason: updatedRefund.rejectionReason,
        },
        entityId: refundId,
      },
    };
  }

  async handleRevertDecision(refundId: string, approve: boolean, deciderId: string, deciderRole: AdminRole) {
    this.assertAdminRole(deciderRole);

    const refund = await this.prisma.adminRefundRequest.findUnique({
      where: { id: refundId },
      include: {
        booking: {
          select: { bookingNumber: true },
        },
        revertRequestedBy: {
          select: { id: true },
        },
      },
    });

    if (!refund) {
      throw new NotFoundException('Refund request not found');
    }
    if (refund.status !== AdminRefundStatus.REVERT_REQUESTED) {
      throw new BadRequestException('Refund is not pending revert approval');
    }

    const beforeSnapshot = {
      refundId,
      status: refund.status,
      bufferExpiresAt: refund.bufferExpiresAt,
      revertReason: refund.revertReason,
    };

    if (approve) {
      const updatedRefund = await this.prisma.adminRefundRequest.update({
        where: { id: refundId },
        data: {
          status: AdminRefundStatus.REVERTED,
          approvedAt: null,
          approvedById: null,
          bufferExpiresAt: null,
          revertReason: null,
          revertRequestedById: null,
          revertRequestedAt: null,
        },
      });

      if (refund.revertRequestedBy?.id) {
        this.notificationsService
          .sendNotification(
            {
              title: 'Refund revert approved',
              message: `Refund revert approved for Booking #${refund.booking.bookingNumber.toString()}`,
              entityId: refundId,
              entityType: 'REFUND',
              actionUrl: `/support/refunds/${refundId}`,
            },
            {
              userId: refund.revertRequestedBy.id,
              event: AdminNotificationEvent.REFUND_REVERT_DECISION,
            },
          )
          .catch((error) => {
            this.logger.error(`Failed to notify revert requester ${refund.revertRequestedBy?.id}`, error);
          });
      }

      return {
        ...updatedRefund,
        [AUDIT_METADATA_KEY]: {
          actionType: AuditActionTypes.REFUND_REVERT_APPROVED,
          beforeSnapshot,
          afterSnapshot: {
            refundId,
            status: updatedRefund.status,
            bufferExpiresAt: null,
          },
          entityId: refundId,
        },
      };
    }

    const bufferExpiresAt = new Date(Date.now() + this.bufferDurationMinutes * 60 * 1000);
    const updatedRefund = await this.prisma.adminRefundRequest.update({
      where: { id: refundId },
      data: {
        status: AdminRefundStatus.APPROVED,
        bufferExpiresAt,
        revertReason: null,
        revertRequestedById: null,
        revertRequestedAt: null,
      },
    });

    await this.supportQueue.scheduleRefundFinalization(refundId, bufferExpiresAt);

    if (refund.revertRequestedBy?.id) {
      this.notificationsService
        .sendNotification(
          {
            title: 'Refund revert rejected',
            message: `Refund remains approved for Booking #${refund.booking.bookingNumber.toString()}`,
            entityId: refundId,
            entityType: 'REFUND',
            actionUrl: `/support/refunds/${refundId}`,
          },
          {
            userId: refund.revertRequestedBy.id,
            event: AdminNotificationEvent.REFUND_REVERT_DECISION,
          },
        )
        .catch((error) => {
          this.logger.error(`Failed to notify revert requester ${refund.revertRequestedBy?.id}`, error);
        });
    }

    return {
      ...updatedRefund,
      [AUDIT_METADATA_KEY]: {
        actionType: AuditActionTypes.REFUND_REVERT_REJECTED,
        beforeSnapshot,
        afterSnapshot: {
          refundId,
          status: updatedRefund.status,
          bufferExpiresAt,
        },
        entityId: refundId,
      },
    };
  }

  async finalizeRefund(refundId: string): Promise<void> {
    const refund = await this.prisma.adminRefundRequest.findUnique({
      where: { id: refundId },
      include: {
        booking: {
          include: {
            invoices: {
              where: { type: 'FINAL' },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    if (!refund) {
      throw new NotFoundException(`Refund ${refundId} not found`);
    }
    if (
      refund.status !== AdminRefundStatus.APPROVED ||
      !refund.bufferExpiresAt ||
      refund.bufferExpiresAt > new Date()
    ) {
      this.logger.log(
        `Skipping refund finalization for ${refundId}; status=${refund.status}, bufferExpiresAt=${refund.bufferExpiresAt?.toISOString() ?? 'null'}`,
      );
      return;
    }

    const invoice = refund.booking.invoices[0];
    if (!invoice) {
      throw new BadRequestException('Refund booking has no final invoice');
    }

    const totalPaid = toDecimal(invoice.walletApplied).plus(toDecimal(invoice.finalAmount));
    if (totalPaid.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Refund booking has no refundable amount');
    }

    const requestedAmount = toDecimal(refund.amount);
    const walletApplied = toDecimal(invoice.walletApplied);
    const walletRefund = totalPaid.greaterThan(0)
      ? truncateDecimal(requestedAmount.mul(walletApplied).div(totalPaid))
      : toDecimal(0);
    const razorpayRefund = truncateDecimal(requestedAmount.minus(walletRefund));

    const refundIntent = await this.prisma.refundIntent.create({
      data: {
        bookingId: refund.bookingId,
        customerId: refund.customerId,
        walletRefundAmount: toNumber(walletRefund),
        razorpayRefundAmount: toNumber(razorpayRefund),
        cancellationCharge: 0,
        rzpPaymentId: invoice.rzpPaymentId ?? undefined,
        status: 'PENDING',
        wasPaid: invoice.isPaid,
        isApproved: true,
      },
    });

    await this.prisma.adminRefundRequest.update({
      where: { id: refundId },
      data: {
        status: AdminRefundStatus.COMPLETED,
        completedAt: new Date(),
        bufferExpiresAt: null,
        refundIntentId: refundIntent.id,
      },
    });

    await this.bookingRefundService.processRefundIntent(refundIntent.id);

    await this.auditLog.log({
      userId: 'SYSTEM',
      role: AdminRole.SUPER_ADMIN,
      actionType: AuditActionTypes.REFUND_COMPLETED,
      module: AuditModules.SYSTEM,
      description: `Refund ${refundId} finalized after buffer expiry`,
      entityId: refundId,
      entityType: 'REFUND_REQUEST',
      afterSnapshot: {
        refundId,
        status: AdminRefundStatus.COMPLETED,
        refundIntentId: refundIntent.id,
      },
    });

    this.firebaseService
      .notifyAllSessions(
        refund.customerId,
        'customer',
        {
          notification: {
            title: 'Refund Processed',
            body: `Your refund for Booking #${refund.booking.bookingNumber.toString()} has been processed.`,
          },
          data: {
            event: FcmEventType.RefundProcessed,
            refundId,
            refundIntentId: refundIntent.id,
            status: AdminRefundStatus.COMPLETED,
          },
        },
        this.prisma,
      )
      .catch((error) => {
        this.logger.error(`Failed to notify customer ${refund.customerId} about refund completion`, error);
      });
  }

  private assertAdminRole(role: AdminRole) {
    if (role !== AdminRole.ADMIN && role !== AdminRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only admins can perform this action');
    }
  }
}
