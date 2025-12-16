import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { RazorpayService } from 'src/razorpay/razorpay.service';
import { RazorpayXService } from 'src/razorpay/razorpayx.service';
import { Booking, BookingStatus, Customer, Driver, Invoice, InvoiceType, PaymentMethod, Prisma, RefundIntent, TransactionCategory, TransactionType } from '@prisma/client';
import { BookingNotificationService } from './booking-notification.service';
import { BookingRefundService } from './booking-refund.service';
import { truncate2 } from '../utils/general.utils';

@Injectable()
export class BookingPaymentService {
  private readonly logger = new Logger(BookingPaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpayService: RazorpayService,
    private readonly razorpayxService: RazorpayXService,
    private readonly notificationService: BookingNotificationService,
  ) {}

  /**
   * Handle webhook from Razorpay when payment succeeds
   * Mark invoice as paid, create transaction, send FCM notifications
   */
  async handlePaymentSuccess(
    invoiceId: string,
    rzpPaymentId: string,
    rzpPaymentLinkId: string,
  ): Promise<void> {
    this.logger.log(`Processing payment success for invoice: ${invoiceId}`);

    // Find FINAL invoice by bookingId (from reference_id)
    const invoice = await this.prisma.invoice.findUnique({
      where: {
        id: invoiceId,
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
      throw new NotFoundException(`Invoice not found for id: ${invoiceId}`);
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

    this.logger.log(`Payment processed successfully for booking ${invoice.bookingId}`);

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
   */
  async processCashPayment(
    finalInvoice: Invoice,
    booking: Booking,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
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
        description: `Cash payment for booking #${booking.bookingNumber}`,
        type: TransactionType.DEBIT, // Customer pays = DEBIT (money OUT)
        category: TransactionCategory.BOOKING_PAYMENT,
        paymentMethod: PaymentMethod.CASH,
      },
    });

    // Cancel payment link if exists (use setImmediate to avoid blocking)
    if (finalInvoice.rzpPaymentLinkId) {
      setImmediate(() => {
        this.razorpayService.cancelPaymentLink(finalInvoice.rzpPaymentLinkId!).catch((error) => {
          this.logger.error(`Failed to cancel payment link ${finalInvoice.rzpPaymentLinkId}: ${error.message}`);
        });
      });
    }
  }

  /**
   * Process payout for a single driver
   * Called by PayoutService cron job
   */
  async processPayout(driver: {
    id: string;
    walletBalance: any;
    fundAccountId: string | null;
    payoutMethod: string | null;
  }): Promise<void> {
    const payoutAmount = Number(driver.walletBalance);

    this.logger.log(`Processing payout for driver ${driver.id}: ₹${payoutAmount}`);

    const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const referenceId = `payout-${driver.id}-${todayStr}`;

    // Select payout mode based on driver's registered payout method
    // BANK_ACCOUNT → IMPS (instant bank transfer)
    // VPA → UPI (instant UPI transfer)
    const payoutMode = driver.payoutMethod === 'VPA' ? 'UPI' : 'IMPS';

    // Create payout via RazorpayX (MONEY MOVEMENT FIRST - before DB logging)
    const payout = await this.razorpayxService.createPayout({
      fundAccountId: driver.fundAccountId!,
      amount: payoutAmount,
      currency: 'INR',
      mode: payoutMode,
      purpose: 'payout',
      referenceId,
    });

    // Now log in DB (after money movement initiated)
    await this.prisma.$transaction(async (tx) => {
      // Deduct from driver wallet
      await tx.driver.update({
        where: { id: driver.id },
        data: { walletBalance: 0 },
      });

      // Log payout
      await tx.driverWalletLog.create({
        data: {
          driverId: driver.id,
          beforeBalance: payoutAmount,
          afterBalance: 0,
          amount: -payoutAmount,
          reason: 'Daily payout to bank account',
        },
      });

      // Create transaction record
      await tx.transaction.create({
        data: {
          driverId: driver.id,
          paymentMethod: PaymentMethod.ONLINE,
          amount: payoutAmount,
          type: TransactionType.CREDIT, // Driver receives payout = CREDIT (money IN)
          category: TransactionCategory.DRIVER_PAYOUT,
          description: `Daily payout - ₹${payoutAmount.toFixed(2)}`,
        },
      });

      // Create payout record
      await tx.payout.create({
        data: {
          driverId: driver.id,
          amount: payoutAmount,
          razorpayPayoutId: payout.razorpayPayoutId,
          status: 'PROCESSING',
          processedAt: new Date(),
        },
      });
    });

    this.logger.log(`✓ Processed payout for driver ${driver.id}: ₹${payoutAmount}`);

    // Send notification (fire-and-forget, outside transaction)
    this.notificationService.notifyDriverPayoutProcessed(driver.id, payoutAmount);
  }
}
