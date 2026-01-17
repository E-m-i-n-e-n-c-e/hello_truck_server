import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { RazorpayService } from 'src/razorpay/razorpay.service';
import {
  Booking,
  Invoice,
  PaymentMethod,
  Prisma,
  TransactionCategory,
  TransactionType,
} from '@prisma/client';
import { BookingNotificationService } from './booking-notification.service';
import { toDecimal, toNumber, truncateDecimal } from '../utils/decimal.utils';

@Injectable()
export class BookingPaymentService {
  private readonly logger = new Logger(BookingPaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpayService: RazorpayService,
    private readonly notificationService: BookingNotificationService,
  ) {}

  /**
   * Handle webhook from Razorpay when payment succeeds
   * Uses payment link ID as source of truth to find the invoice
   */
  async handlePaymentSuccess(
    rzpPaymentLinkId: string,
    rzpPaymentId: string,
  ): Promise<void> {
    this.logger.log(
      `Processing payment success for payment link: ${rzpPaymentLinkId}`,
    );

    // Find invoice by payment link ID (source of truth)
    const invoice = await this.prisma.invoice.findUnique({
      where: {
        rzpPaymentLinkId: rzpPaymentLinkId,
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
      throw new NotFoundException(
        `Invoice not found for payment link: ${rzpPaymentLinkId}`,
      );
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
          paymentMethod: PaymentMethod.ONLINE,
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
          paymentMethod: PaymentMethod.ONLINE,
          amount: invoice.finalAmount,
          type: TransactionType.DEBIT, // Customer pays = DEBIT (money OUT)
          category: TransactionCategory.BOOKING_PAYMENT,
          description: `Payment for Booking #${invoice.booking.bookingNumber}`,
        },
      });
    });

    this.logger.log(
      `Payment processed successfully for booking ${invoice.bookingId}`,
    );

    // Send notifications (fire-and-forget, outside transaction)
    if (invoice.booking.customerId) {
      this.notificationService.notifyCustomerPaymentSuccess(
        invoice.booking.customerId,
        Number(invoice.finalAmount),
        Number(invoice.booking.bookingNumber),
      );
    }

    if (invoice.booking.assignedDriverId) {
      this.notificationService.notifyDriverPaymentReceived(
        invoice.booking.assignedDriverId,
        invoice.bookingId,
        Number(invoice.finalAmount),
      );
    }
  }

  /**
   * Process cash payment for a booking
   * Marks invoice as paid with CASH payment method and creates transaction
   * Sends notifications and cancels payment link
   */
  async processCashPayment(
    finalInvoice: Invoice,
    booking: Booking,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Mark invoice as paid with cash
      await tx.invoice.update({
        where: { id: finalInvoice.id },
        data: {
          isPaid: true,
          paymentMethod: PaymentMethod.CASH,
          paidAt: new Date(),
        },
      });

      // Create transaction record
      await tx.transaction.create({
        data: {
          amount: finalInvoice.finalAmount,
          bookingId: booking.id,
          customerId: booking.customerId,
          description: `Payment for booking #${booking.bookingNumber}`,
          type: TransactionType.DEBIT, // Customer pays = DEBIT (money OUT)
          category: TransactionCategory.BOOKING_PAYMENT,
          paymentMethod: PaymentMethod.CASH,
        },
      });
    });

    // Send notifications (fire-and-forget, outside transaction)
    if (booking.customerId) {
      this.notificationService.notifyCustomerPaymentSuccess(
        booking.customerId,
        Number(finalInvoice.finalAmount),
        Number(booking.bookingNumber),
      );
    }

    if (booking.assignedDriverId) {
      this.notificationService.notifyDriverPaymentReceived(
        booking.assignedDriverId,
        booking.id,
        Number(finalInvoice.finalAmount),
      );
    }

    // Cancel payment link if exists (fire-and-forget, outside transaction)
    if (finalInvoice.rzpPaymentLinkId) {
      this.razorpayService
        .cancelPaymentLink(finalInvoice.rzpPaymentLinkId)
        .catch((error) => {
          this.logger.error(
            `Failed to cancel payment link ${finalInvoice.rzpPaymentLinkId}: ${error.message}`,
          );
        });
    }
  }
}
