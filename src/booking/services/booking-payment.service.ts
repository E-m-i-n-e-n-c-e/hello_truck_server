import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RazorpayService } from 'src/razorpay/razorpay.service';
import { FirebaseService } from 'src/firebase/firebase.service';
import { Booking, BookingStatus, Customer, Driver, Invoice, InvoiceType, Prisma } from '@prisma/client';
import { FcmEventType } from 'src/common/types/fcm.types';
import { truncate2 } from '../utils/general.utils';

@Injectable()
export class BookingPaymentService {
  private readonly logger = new Logger(BookingPaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpayService: RazorpayService,
    private readonly firebaseService: FirebaseService,
  ) {}

  /**
   * Handle webhook from Razorpay when payment succeeds
   * Mark invoice as paid, create transaction, send FCM notifications
   */
  async handlePaymentSuccess(
    bookingId: string,
    rzpPaymentId: string,
    rzpPaymentLinkId: string,
  ): Promise<void> {
    this.logger.log(`Processing payment success for booking: ${bookingId}`);

    // Find FINAL invoice by bookingId (from reference_id)
    const invoice = await this.prisma.invoice.findUnique({
      where: { 
        bookingId_type: {
          bookingId,
          type: InvoiceType.FINAL,
        },
      },
      include: {
        booking: {
          include: {
            customer: true,
            assignedDriver: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException(`FINAL invoice not found for booking: ${bookingId}`);
    }

    if (invoice.isPaid) {
      this.logger.warn(`Invoice ${invoice.id} already marked as paid`);
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      // Mark invoice as paid
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          isPaid: true,
          paidAt: new Date(),
          rzpPaymentId,
          rzpPaymentLinkId,
        },
      });

      // Create transaction record
      await tx.transaction.create({
        data: {
          customerId: invoice.booking.customerId,
          bookingId: invoice.bookingId,
          amount: invoice.finalAmount,
          type: 'CREDIT',
          category: 'BOOKING_PAYMENT',
          description: `Payment for Booking #${invoice.booking.bookingNumber}`,
        },
      });
    });

    this.logger.log(`Payment processed successfully for booking ${invoice.bookingId}`);
    
    // Send notifications (fire-and-forget, outside transaction)
    if (invoice.booking.customerId) {
      this.firebaseService.notifyAllSessions(invoice.booking.customerId, 'customer', {
        notification: {
          title: 'Payment Successful! ✅',
          body: `Your payment of ₹${Number(invoice.finalAmount).toFixed(2)} for Booking #${invoice.booking.bookingNumber} was successful`,
        },
        data: {
          event: FcmEventType.PaymentSuccess,
          bookingId: invoice.bookingId,
          amount: invoice.finalAmount.toString(),
        },
      });
    }

    if (invoice.booking.assignedDriverId) {
      this.firebaseService.notifyAllSessions(invoice.booking.assignedDriverId, 'driver', {
        data: {
          event: FcmEventType.PaymentSuccess,
          bookingId: invoice.bookingId,
          amount: invoice.finalAmount.toString(),
        },
      });
    }
  }

  /**
   * Process refund for a cancelled booking (utility method)
   * Should be called within a transaction by BookingCustomerService
   */
  async processRefund(
    customerId: string,
    booking: Booking & { customer: Customer; },
    finalInvoice: Invoice,
    reason: string | undefined,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    // Calculate refund amounts based on booking status
    const { walletRefund, razorpayRefund } = this.calculateRefundAmounts(
      booking.status,
      finalInvoice,
    );

    const customerWalletBefore = Number(booking.customer?.walletBalance);

    // Refund wallet amount (make wallet less negative or more positive)
    if (walletRefund > 0) {
      const newWalletBalance = truncate2(customerWalletBefore + walletRefund);

      await tx.customer.update({
        where: { id: customerId },
        data: { walletBalance: newWalletBalance },
      });

      // Log wallet change
      await tx.customerWalletLog.create({
        data: {
          customerId,
          beforeBalance: customerWalletBefore,
          afterBalance: newWalletBalance,
          amount: walletRefund,
          reason: `Refund for cancelled Booking #${booking.bookingNumber}`,
          bookingId: booking.id,
        },
      });
    }

    // Notify wallet credit after transaction
    if (walletRefund > 0) {
      this.firebaseService.notifyAllSessions(customerId, 'customer', {
        notification: {
          title: 'Wallet Credited! 💰',
          body: `₹${walletRefund.toFixed(2)} refund added to your wallet`,
        },
        data: {
          event: FcmEventType.WalletCredit,
          amount: walletRefund.toString(),
        },
      });
    }

    // Process Razorpay refund if payment was made
    if (razorpayRefund > 0 && finalInvoice.isPaid && finalInvoice.rzpPaymentId) {
      try {
        await this.razorpayService.createRefund({
          paymentId: finalInvoice.rzpPaymentId,
          amount: razorpayRefund,
          notes: {
            bookingId: booking.id,
            reason: reason || 'Booking cancelled',
          },
        });

        // Create refund transaction
        await tx.transaction.create({
          data: {
            customerId,
            bookingId: booking.id,
            amount: razorpayRefund,
            type: 'DEBIT',
            category: 'BOOKING_REFUND',
            description: `Refund for cancelled Booking #${booking.bookingNumber}`,
          },
        });
      } catch (error) {
        this.logger.error(`Failed to process Razorpay refund: ${error.message}`);
        throw new BadRequestException('Failed to process refund');
      }
    }
  }

  /**
   * Calculate refund amounts based on booking status
   */
  private calculateRefundAmounts(
    status: BookingStatus,
    invoice: Invoice,
  ): {
    walletRefund: number;
    razorpayRefund: number;
    cancellationCharge: number;
  } {
    const walletApplied = Number(invoice.walletApplied);
    const finalAmount = Number(invoice.finalAmount);
    const totalPaid = walletApplied + finalAmount;

    // Full refund for PENDING and DRIVER_ASSIGNED
    if (status === BookingStatus.PENDING || status === BookingStatus.DRIVER_ASSIGNED) {
      return {
        walletRefund: walletApplied,
        razorpayRefund: finalAmount,
        cancellationCharge: 0,
      };
    }

    // 50% refund for CONFIRMED and PICKUP_ARRIVED
    if (status === BookingStatus.CONFIRMED || status === BookingStatus.PICKUP_ARRIVED) {
      const refundPercentage = 0.5;
      return {
        walletRefund: walletApplied * refundPercentage,
        razorpayRefund: finalAmount * refundPercentage,
        cancellationCharge: totalPaid * (1 - refundPercentage),
      };
    }

    // No refund for other statuses
    return {
      walletRefund: 0,
      razorpayRefund: 0,
      cancellationCharge: totalPaid,
    };
  }
}
