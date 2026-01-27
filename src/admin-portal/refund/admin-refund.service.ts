/**
 * Admin Refund Service
 *
 * Handles manual refund workflows:
 * - Create refund request (Customer Support)
 * - Approve/reject refund (Admin)
 * - Buffer window management
 * - Revert request flow
 * - Integration with existing RefundIntent for processing
 */
import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { AdminRole, AdminRefundStatus, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { RefundQueueService } from './refund-queue.service';
import { AuditLogService, AuditActionTypes, AuditModules } from '../audit-log/audit-log.service';
import { AdminFirebaseService } from '../firebase/admin-firebase.service';
import { RazorpayService } from '../razorpay/razorpay.service';
import { FcmEventType } from '../../common/types/fcm.types';
import { CreateRefundDto } from './dto/create-refund.dto';
import { ListRefundsDto } from './dto/list-refunds.dto';

@Injectable()
export class AdminRefundService {
  private readonly logger = new Logger(AdminRefundService.name);
  private readonly bufferDuration: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly refundQueue: RefundQueueService,
    private readonly auditLog: AuditLogService,
    private readonly firebaseService: AdminFirebaseService,
    private readonly razorpayService: RazorpayService,
  ) {
    this.bufferDuration = this.configService.get<number>('ADMIN_BUFFER_DURATION_MINUTES', 60);
  }

  /**
   * Create a new refund request (Customer Support)
   * Creates RefundIntent immediately with isApproved: false
   */
  async createRefund(dto: CreateRefundDto, createdById: string, creatorRole: AdminRole) {
    // Validate booking exists
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
      include: {
        customer: true,
        assignedDriver: true,
        package: true,
        invoices: {
          where: { type: 'FINAL' },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (!booking.customerId) {
      throw new BadRequestException('Booking has no customer');
    }

    // Validate customer matches
    if (dto.customerId && booking.customerId !== dto.customerId) {
      throw new BadRequestException('Customer ID does not match booking');
    }

    // Get invoice data (use the FINAL invoice)
    const invoice = booking.invoices?.[0];
    if (!invoice) {
      throw new BadRequestException('Booking has no final invoice');
    }

    // Calculate total paid
    const walletApplied = new Decimal(invoice.walletApplied);
    const razorpayPaid = new Decimal(invoice.finalAmount);
    const totalPaid = walletApplied.plus(razorpayPaid);

    // Validate cancellation charge
    const cancellationCharge = dto.cancellationCharge ?? 0;
    if (cancellationCharge < 0) {
      throw new BadRequestException('Cancellation charge cannot be negative');
    }
    if (new Decimal(cancellationCharge).greaterThan(totalPaid)) {
      throw new BadRequestException(
        `Cancellation charge (₹${cancellationCharge}) cannot exceed total paid (₹${totalPaid.toNumber()})`
      );
    }

    // Check for duplicate pending refund
    const existingRefund = await this.prisma.adminRefundRequest.findFirst({
      where: {
        bookingId: dto.bookingId,
        status: { in: [AdminRefundStatus.INITIATED, AdminRefundStatus.APPROVED] },
      },
    });

    if (existingRefund) {
      throw new BadRequestException('A refund request already exists for this booking');
    }

    // Calculate refund amounts with proportional cancellation charge split
    const cancellationChargeDecimal = new Decimal(cancellationCharge);
    const walletShare = totalPaid.greaterThan(0)
      ? cancellationChargeDecimal.mul(walletApplied).div(totalPaid)
      : new Decimal(0);
    const razorpayShare = totalPaid.greaterThan(0)
      ? cancellationChargeDecimal.mul(razorpayPaid).div(totalPaid)
      : new Decimal(0);

    const walletRefund = walletApplied.minus(walletShare);
    const razorpayRefund = razorpayPaid.minus(razorpayShare);

    // Create refund request and RefundIntent in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create refund request
      const refund = await tx.adminRefundRequest.create({
        data: {
          bookingId: dto.bookingId,
          customerId: booking.customerId!,
          driverId: booking.assignedDriverId,
          amount: dto.amount,
          reason: dto.reason,
          phoneNumber: booking.customer?.phoneNumber ?? '',
          notes: dto.notes,
          createdById,
          status: AdminRefundStatus.INITIATED,
        },
        include: {
          booking: true,
          customer: true,
          driver: true,
          createdBy: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      });

      // Create RefundIntent immediately with isApproved: false
      await tx.refundIntent.create({
        data: {
          bookingId: dto.bookingId,
          customerId: booking.customerId!,
          walletRefundAmount: walletRefund.toNumber(),
          razorpayRefundAmount: razorpayRefund.toNumber(),
          cancellationCharge: cancellationCharge,
          rzpPaymentId: invoice.rzpPaymentId ?? undefined,
          status: 'PENDING',
          wasPaid: invoice.isPaid,
          isApproved: false, // Not approved yet
        },
      });

      return refund;
    });

    // Log the action
    await this.auditLog.log({
      userId: createdById,
      role: creatorRole,
      actionType: AuditActionTypes.REFUND_CREATED,
      module: AuditModules.REFUND,
      description: `Refund request created for booking ${dto.bookingId}, amount: ₹${dto.amount}`,
      entityId: result.id,
      entityType: 'AdminRefundRequest',
      afterSnapshot: { status: result.status, amount: result.amount },
    });

    // Send RefundCreated notification to customer
    if (result.customerId) {
      await this.firebaseService.notifyAllSessions(
        result.customerId,
        'customer',
        {
          notification: {
            title: 'Refund Request Created',
            body: `A refund request of ₹${dto.amount} has been created for your booking.`,
          },
          data: {
            event: FcmEventType.RefundCreated,
            refundId: result.id,
            amount: dto.amount.toString(),
          },
        },
        this.prisma,
      );
    }

    return result;
  }

  /**
   * List refund requests with filters
   */
  async listRefunds(filters: ListRefundsDto) {
    const { status, bookingId, customerId, driverId, search, page = 1, limit = 20 } = filters;

    const where: Prisma.AdminRefundRequestWhereInput = {};

    if (status) {
      where.status = status;
    }
    if (bookingId) {
      where.bookingId = bookingId;
    }
    if (customerId) {
      where.customerId = customerId;
    }
    if (driverId) {
      where.driverId = driverId;
    }
    if (search) {
      where.OR = [
        { booking: { id: { contains: search, mode: 'insensitive' } } },
        { reason: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [refunds, total] = await Promise.all([
      this.prisma.adminRefundRequest.findMany({
        where,
        include: {
          booking: {
            select: { id: true, status: true },
          },
          customer: {
            select: { id: true, firstName: true, lastName: true, phoneNumber: true },
          },
          driver: {
            select: { id: true, firstName: true, lastName: true, phoneNumber: true },
          },
          createdBy: {
            select: { id: true, firstName: true, lastName: true },
          },
          approvedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.adminRefundRequest.count({ where }),
    ]);

    return {
      refunds: refunds.map(r => ({
        ...r,
        isInBuffer: r.status === AdminRefundStatus.APPROVED && r.bufferExpiresAt && r.bufferExpiresAt > new Date(),
        bufferRemainingMinutes: r.bufferExpiresAt ? Math.max(0, Math.ceil((r.bufferExpiresAt.getTime() - Date.now()) / 60000)) : 0,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get refund by ID
   */
  async getRefundById(id: string) {
    const refund = await this.prisma.adminRefundRequest.findUnique({
      where: { id },
      include: {
        booking: true,
        customer: true,
        driver: true,
        createdBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        approvedBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });

    if (!refund) {
      throw new NotFoundException('Refund request not found');
    }

    return {
      ...refund,
      isInBuffer: refund.status === AdminRefundStatus.APPROVED && refund.bufferExpiresAt && refund.bufferExpiresAt > new Date(),
      bufferRemainingMinutes: refund.bufferExpiresAt ? Math.max(0, Math.ceil((refund.bufferExpiresAt.getTime() - Date.now()) / 60000)) : 0,
    };
  }

  /**
   * Approve refund (Admin only)
   */
  async approveRefund(refundId: string, approverId: string, approverRole: AdminRole) {
    const refund = await this.prisma.adminRefundRequest.findUnique({
      where: { id: refundId },
    });

    if (!refund) {
      throw new NotFoundException('Refund request not found');
    }
    if (refund.status !== AdminRefundStatus.INITIATED) {
      throw new BadRequestException('Only initiated refunds can be approved');
    }

    const bufferExpiresAt = new Date(Date.now() + this.bufferDuration * 60 * 1000);
    const beforeSnapshot = { status: refund.status };

    // Update refund status
    const updatedRefund = await this.prisma.adminRefundRequest.update({
      where: { id: refundId },
      data: {
        status: AdminRefundStatus.APPROVED,
        approvedById: approverId,
        approvedAt: new Date(),
        bufferExpiresAt,
      },
      include: {
        customer: true,
        driver: true,
      },
    });

    // Schedule buffer expiry job
    await this.refundQueue.scheduleRefundFinalization(refundId, bufferExpiresAt);

    // Log the action
    await this.auditLog.log({
      userId: approverId,
      role: approverRole,
      actionType: AuditActionTypes.REFUND_APPROVED,
      module: AuditModules.REFUND,
      description: `Refund ${refundId} approved, buffer until ${bufferExpiresAt.toISOString()}`,
      entityId: refundId,
      entityType: 'AdminRefundRequest',
      beforeSnapshot,
      afterSnapshot: { status: updatedRefund.status, bufferExpiresAt },
    });

    // Notify customer
    if (updatedRefund.customerId) {
      await this.firebaseService.notifyAllSessions(
        updatedRefund.customerId,
        'customer',
        {
          notification: {
            title: 'Refund Approved',
            body: `Your refund of ₹${updatedRefund.amount} has been approved and will be processed soon.`,
          },
          data: {
            event: FcmEventType.RefundProcessed,
            refundId: updatedRefund.id,
            amount: updatedRefund.amount.toString(),
          },
        },
        this.prisma,
      );
    }

    return updatedRefund;
  }

  /**
   * Reject refund (Admin only)
   */
  async rejectRefund(refundId: string, reason: string, rejectorId: string, rejectorRole: AdminRole) {
    const refund = await this.prisma.adminRefundRequest.findUnique({
      where: { id: refundId },
    });

    if (!refund) {
      throw new NotFoundException('Refund request not found');
    }
    if (refund.status !== AdminRefundStatus.INITIATED) {
      throw new BadRequestException('Only initiated refunds can be rejected');
    }

    const beforeSnapshot = { status: refund.status };

    const updatedRefund = await this.prisma.adminRefundRequest.update({
      where: { id: refundId },
      data: {
        status: AdminRefundStatus.REJECTED,
        revertReason: reason,
      },
    });

    // Log the action
    await this.auditLog.log({
      userId: rejectorId,
      role: rejectorRole,
      actionType: AuditActionTypes.REFUND_REJECTED,
      module: AuditModules.REFUND,
      description: `Refund ${refundId} rejected. Reason: ${reason}`,
      entityId: refundId,
      entityType: 'AdminRefundRequest',
      beforeSnapshot,
      afterSnapshot: { status: updatedRefund.status, revertReason: reason },
    });

    return updatedRefund;
  }

  /**
   * Request revert during buffer window (Support)
   */
  async requestRevert(refundId: string, reason: string, requesterId: string, requesterRole: AdminRole) {
    const refund = await this.prisma.adminRefundRequest.findUnique({
      where: { id: refundId },
    });

    if (!refund) {
      throw new NotFoundException('Refund request not found');
    }
    if (refund.status !== AdminRefundStatus.APPROVED) {
      throw new BadRequestException('Only approved refunds can be reverted');
    }
    if (!refund.bufferExpiresAt || refund.bufferExpiresAt < new Date()) {
      throw new BadRequestException('Buffer window has expired');
    }

    const beforeSnapshot = { status: refund.status };

    // Update to revert requested
    const updatedRefund = await this.prisma.adminRefundRequest.update({
      where: { id: refundId },
      data: {
        status: AdminRefundStatus.REVERT_REQUESTED,
        revertReason: reason,
        revertRequestedById: requesterId,
        revertRequestedAt: new Date(),
      },
    });

    // Cancel pending finalization
    await this.refundQueue.cancelRefundFinalization(refundId);

    // Log the action
    await this.auditLog.log({
      userId: requesterId,
      role: requesterRole,
      actionType: AuditActionTypes.REFUND_REVERT_REQUESTED,
      module: AuditModules.REFUND,
      description: `Revert requested for refund ${refundId}. Reason: ${reason}`,
      entityId: refundId,
      entityType: 'AdminRefundRequest',
      beforeSnapshot,
      afterSnapshot: { status: updatedRefund.status, revertReason: reason },
    });

    return updatedRefund;
  }

  /**
   * Approve/reject revert request (Admin only)
   */
  async handleRevertDecision(refundId: string, approve: boolean, deciderId: string, deciderRole: AdminRole) {
    const refund = await this.prisma.adminRefundRequest.findUnique({
      where: { id: refundId },
    });

    if (!refund) {
      throw new NotFoundException('Refund request not found');
    }
    if (refund.status !== AdminRefundStatus.REVERT_REQUESTED) {
      throw new BadRequestException('No pending revert request');
    }

    const beforeSnapshot = { status: refund.status };

    if (approve) {
      // Revert to initiated
      const updatedRefund = await this.prisma.adminRefundRequest.update({
        where: { id: refundId },
        data: {
          status: AdminRefundStatus.REVERTED,
          bufferExpiresAt: null,
        },
      });

      await this.auditLog.log({
        userId: deciderId,
        role: deciderRole,
        actionType: AuditActionTypes.REFUND_REVERT_APPROVED,
        module: AuditModules.REFUND,
        description: `Revert approved for refund ${refundId}`,
        entityId: refundId,
        entityType: 'AdminRefundRequest',
        beforeSnapshot,
        afterSnapshot: { status: updatedRefund.status },
      });

      return updatedRefund;
    } else {
      // Reject revert, restore approved status with new buffer
      const newBufferExpiresAt = new Date(Date.now() + this.bufferDuration * 60 * 1000);

      const updatedRefund = await this.prisma.adminRefundRequest.update({
        where: { id: refundId },
        data: {
          status: AdminRefundStatus.APPROVED,
          bufferExpiresAt: newBufferExpiresAt,
        },
      });

      // Reschedule finalization
      await this.refundQueue.scheduleRefundFinalization(refundId, newBufferExpiresAt);

      await this.auditLog.log({
        userId: deciderId,
        role: deciderRole,
        actionType: AuditActionTypes.REFUND_REVERT_REJECTED,
        module: AuditModules.REFUND,
        description: `Revert rejected for refund ${refundId}, buffer reset`,
        entityId: refundId,
        entityType: 'AdminRefundRequest',
        beforeSnapshot,
        afterSnapshot: { status: updatedRefund.status, bufferExpiresAt: newBufferExpiresAt },
      });

      return updatedRefund;
    }
  }

  /**
   * Finalize refund after buffer expires (called by queue processor)
   * Marks RefundIntent as approved and processes refund asynchronously
   */
  async finalizeRefund(refundId: string) {
    const refund = await this.prisma.adminRefundRequest.findUnique({
      where: { id: refundId },
      include: {
        booking: true,
        customer: true,
      },
    });

    if (!refund || refund.status !== AdminRefundStatus.APPROVED) {
      this.logger.warn(`Refund ${refundId} not in APPROVED status, skipping finalization`);
      return;
    }

    // Find RefundIntent for this booking
    const refundIntent = await this.prisma.refundIntent.findFirst({
      where: {
        bookingId: refund.bookingId,
        isApproved: false,
      },
    });

    if (!refundIntent) {
      this.logger.error(`No RefundIntent found for booking ${refund.bookingId}`);
      return;
    }

    // Update status to COMPLETED
    const updatedRefund = await this.prisma.adminRefundRequest.update({
      where: { id: refundId },
      data: {
        status: AdminRefundStatus.COMPLETED,
        completedAt: new Date(),
      },
    });

    // Mark RefundIntent as approved
    await this.prisma.refundIntent.update({
      where: { id: refundIntent.id },
      data: { isApproved: true },
    });

    // Process refund asynchronously (fire-and-forget)
    this.processAdminRefund(refundIntent.id).catch(err => {
      this.logger.error(`Async refund processing failed for ${refundIntent.id}: ${err.message}`);
    });

    // Log the action
    await this.auditLog.log({
      userId: 'SYSTEM',
      role: AdminRole.SUPER_ADMIN,
      actionType: AuditActionTypes.REFUND_COMPLETED,
      module: AuditModules.SYSTEM,
      description: `Refund ${refundId} finalized after buffer expiry`,
      entityId: refundId,
      entityType: 'AdminRefundRequest',
      afterSnapshot: { status: updatedRefund.status },
    });

    this.logger.log(`Refund ${refundId} finalized successfully`);
  }

  /**
   * Process admin refund (duplicated from booking-refund.service)
   * Handles wallet and Razorpay refunds
   */
  private async processAdminRefund(intentId: string): Promise<void> {
    // Atomic claim: Mark as PROCESSING only if still PENDING
    const claimed = await this.prisma.refundIntent.updateMany({
      where: {
        id: intentId,
        status: 'PENDING',
        isApproved: true,
      },
      data: { status: 'PROCESSING' },
    });

    if (claimed.count === 0) {
      this.logger.log(`Refund intent ${intentId} already claimed or not approved`);
      return;
    }

    // Fetch intent with booking data
    const intent = await this.prisma.refundIntent.findUniqueOrThrow({
      where: { id: intentId },
      include: {
        booking: {
          include: {
            customer: true,
            assignedDriver: true,
          },
        },
      },
    });

    try {
      // Execute Razorpay refund FIRST (money movement)
      let rzpRefundId: string | null = null;
      if (Number(intent.razorpayRefundAmount) > 0 && intent.rzpPaymentId) {
        rzpRefundId = await this.executeRazorpayRefund(
          intent.booking,
          intent.rzpPaymentId,
          Number(intent.razorpayRefundAmount),
          'Admin refund',
        );
      }

      // Then update DB
      await this.prisma.$transaction(async (tx) => {
        // Fetch fresh booking data
        const booking = await tx.booking.findUniqueOrThrow({
          where: { id: intent.bookingId },
          include: { customer: true },
        });

        // Credit wallet refund (can be negative if customer had debt)
        if (Number(intent.walletRefundAmount) !== 0 && booking.customer) {
          const walletBefore = new Decimal(booking.customer.walletBalance);
          const amountDecimal = new Decimal(intent.walletRefundAmount);
          const newBalance = walletBefore.plus(amountDecimal).toDecimalPlaces(2, Decimal.ROUND_DOWN);

          await tx.customer.update({
            where: { id: intent.customerId },
            data: { walletBalance: newBalance.toNumber() },
          });

          await tx.customerWalletLog.create({
            data: {
              customerId: intent.customerId,
              beforeBalance: walletBefore.toNumber(),
              afterBalance: newBalance.toNumber(),
              amount: amountDecimal.toNumber(),
              reason: `Admin refund for Booking #${booking.bookingNumber}`,
              bookingId: booking.id,
              refundIntentId: intentId,
            },
          });

          this.logger.log(`Credited ₹${intent.walletRefundAmount} to customer ${intent.customerId} wallet`);
        }

        // Create transaction record for Razorpay refund
        if (rzpRefundId) {
          await tx.transaction.create({
            data: {
              customerId: intent.customerId,
              bookingId: intent.bookingId,
              paymentMethod: 'ONLINE',
              amount: intent.razorpayRefundAmount,
              type: 'CREDIT',
              category: 'BOOKING_REFUND',
              description: `Admin refund for booking #${booking.bookingNumber}`,
              refundIntentId: intentId,
            },
          });
        }

        // Mark as completed
        await tx.refundIntent.update({
          where: { id: intentId },
          data: {
            status: 'COMPLETED',
            rzpRefundId,
            processedAt: new Date(),
          },
        });
      });

      this.logger.log(`✓ Admin refund processed: ${intentId}`);

      // Notify customer about refund completion
      if (intent.customerId) {
        await this.firebaseService.notifyAllSessions(
          intent.customerId,
          'customer',
          {
            notification: {
              title: 'Refund Processed',
              body: `Your refund has been processed successfully.`,
            },
            data: {
              event: FcmEventType.RefundProcessed,
              refundId: intentId,
            },
          },
          this.prisma,
        );
      }
    } catch (error) {
      this.logger.error(`✗ Admin refund FAILED: ${intentId} ${error.message}`);

      // Retry logic
      const newRetryCount = intent.retryCount + 1;

      try {
        await this.prisma.refundIntent.update({
          where: { id: intentId },
          data: {
            status: newRetryCount >= intent.maxRetries ? 'FAILED' : 'PENDING',
            failureReason: error.message,
            retryCount: newRetryCount,
          },
        });

        if (newRetryCount >= intent.maxRetries) {
          this.logger.error(`✗ Admin refund FAILED after max retries: ${intentId}`);
        } else {
          this.logger.warn(`Admin refund retry ${newRetryCount}/${intent.maxRetries} for ${intentId}`);
        }
      } catch (updateError) {
        this.logger.error(`Failed to update refund intent ${intentId} retry status: ${updateError.message}`);
      }
    }
  }

  /**
   * Execute Razorpay refund with idempotency check
   */
  private async executeRazorpayRefund(
    booking: any,
    rzpPaymentId: string,
    amount: number,
    reason: string,
  ): Promise<string | null> {
    if (amount <= 0 || !rzpPaymentId) return null;

    try {
      // Check if refund already exists (idempotency)
      const existingRefunds = await this.razorpayService.fetchRefunds(rzpPaymentId);
      const matchedRefund = existingRefunds.find(
        r => r.amount === amount && r.notes?.bookingId === booking.id
      );

      if (matchedRefund) {
        this.logger.warn(`Refund already exists on Razorpay (ID: ${matchedRefund.refundId})`);
        return matchedRefund.refundId;
      }

      // Create new refund
      const refund = await this.razorpayService.createRefund({
        paymentId: rzpPaymentId,
        amount,
        notes: {
          bookingId: booking.id,
          reason: reason || 'Admin refund',
        },
      });

      this.logger.log(`Razorpay refund created: ₹${amount} for booking ${booking.id}`);
      return refund.refundId;
    } catch (error) {
      this.logger.error(`Razorpay refund failed: ${error.message}`);
      throw error;
    }
  }
}
