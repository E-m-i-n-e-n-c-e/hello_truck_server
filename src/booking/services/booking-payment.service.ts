import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { RazorpayService } from 'src/razorpay/razorpay.service';
import { Booking, BookingStatus, Customer, Driver, Invoice, InvoiceType, PaymentMethod, Prisma, TransactionCategory, TransactionType } from '@prisma/client';
import { BookingNotificationService } from './booking-notification.service';
import { truncate2 } from '../utils/general.utils';

@Injectable()
export class BookingPaymentService {
  private readonly logger = new Logger(BookingPaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpayService: RazorpayService,
    private readonly notificationService: BookingNotificationService,
    private readonly configService: ConfigService,
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
          type: TransactionType.CREDIT,
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
   * Process refund for a cancelled booking (utility method)
   * Should be called within a transaction by BookingCustomerService
   */
  async processRefund(
    customerId: string,
    booking: Booking & { customer: Customer; assignedDriver: Driver | null; },
    finalInvoice: Invoice,
    reason: string | undefined,
    tx: Prisma.TransactionClient,
  ): Promise<{ walletRefund: number; razorpayRefund: number; driverCompensation: number; driverId: string | null }> {
    // Calculate refund amounts based on booking status
    const { walletRefund, razorpayRefund, cancellationCharge } = this.calculateRefundAmounts(
      booking.status,
      finalInvoice,
    );

    // Handle customer wallet refund or charge
    await this.handleCustomerWalletRefund(
      customerId,
      booking,
      finalInvoice,
      walletRefund,
      razorpayRefund,
      cancellationCharge,
      tx,
    );
    
    // Process driver compensation
    let driverCompensation: number = 0;
    let driverId: string | null = null;
    if(cancellationCharge > 0 && booking.assignedDriver) {
      const driverCompensationData = await this.processDriverCompensation(
        booking,
        booking.assignedDriver,
        cancellationCharge,
        tx,
      );
      driverCompensation = driverCompensationData.driverCompensation;
      driverId = driverCompensationData.driverId;
    }
    // Process Razorpay refund if applicable
    await this.processRazorpayRefund(
      customerId,
      booking,
      finalInvoice,
      razorpayRefund,
      reason,
      tx,
    );
    
    // Return appropriate wallet refund value
    // For unpaid invoices with cancellation, return negative value to indicate debit
    const finalWalletRefund = finalInvoice.isPaid ? walletRefund : (cancellationCharge > 0 ? -cancellationCharge : 0);
    
    return { walletRefund: finalWalletRefund, razorpayRefund, driverCompensation, driverId };
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
        type: TransactionType.CREDIT,
        category: TransactionCategory.BOOKING_PAYMENT,
        paymentMethod: PaymentMethod.CASH,
      },
    });
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

    // Partial refund for CONFIRMED and PICKUP_ARRIVED
    if (status === BookingStatus.CONFIRMED || status === BookingStatus.PICKUP_ARRIVED) {
      const refundPercentage = this.configService.get<number>('REFUND_PERCENTAGE') ?? 0.5;
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

  /**
   * Handle customer wallet refund or charge for cancellation
   */
  private async handleCustomerWalletRefund(
    customerId: string,
    booking: Booking & { customer: Customer },
    finalInvoice: Invoice,
    walletRefund: number,
    razorpayRefund: number,
    cancellationCharge: number,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const customerWalletBefore = Number(booking.customer?.walletBalance);

    if (finalInvoice.isPaid) {
      // For cash payments, refund everything to wallet (can't refund via Razorpay)
      // For online payments, only refund the wallet portion (Razorpay refund handled separately)
      const isCashPayment = finalInvoice.paymentMethod === PaymentMethod.CASH;
      const totalWalletRefund = isCashPayment ? walletRefund + razorpayRefund : walletRefund;

      if (totalWalletRefund > 0) {
        const newWalletBalance = truncate2(customerWalletBefore + totalWalletRefund);

        await tx.customer.update({
          where: { id: customerId },
          data: { walletBalance: newWalletBalance },
        });

        await tx.customerWalletLog.create({
          data: {
            customerId,
            beforeBalance: customerWalletBefore,
            afterBalance: newWalletBalance,
            amount: totalWalletRefund,
            reason: isCashPayment
              ? `Cash refund for cancelled Booking #${booking.bookingNumber}`
              : `Refund for cancelled Booking #${booking.bookingNumber}`,
            bookingId: booking.id,
          },
        });
      }
    } else {
      // Handle unpaid invoice - charge cancellation fee to wallet if applicable
      if (cancellationCharge > 0) {
        const chargeAmount = truncate2(-cancellationCharge);
        const newWalletBalance = truncate2(customerWalletBefore + chargeAmount);
        
        await tx.customer.update({
          where: { id: customerId },
          data: { walletBalance: newWalletBalance },
        });
        
        await tx.customerWalletLog.create({
          data: {
            customerId,
            beforeBalance: customerWalletBefore,
            afterBalance: newWalletBalance,
            amount: chargeAmount,
            reason: `Cancellation charge for Booking #${booking.bookingNumber}`,
            bookingId: booking.id,
          },
        });
      }
    }
  }

  /**
   * Process Razorpay refund if applicable
   */
  private async processRazorpayRefund(
    customerId: string,
    booking: Booking,
    finalInvoice: Invoice,
    razorpayRefund: number,
    reason: string | undefined,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    if (
      razorpayRefund > 0 &&
      finalInvoice.isPaid &&
      finalInvoice.paymentMethod === PaymentMethod.ONLINE &&
      finalInvoice.rzpPaymentId
    ) {
      try {
        // Safe Retry: Check if refund already exists on Razorpay side
        // This handles case where API call succeeded but DB transaction failed/rolled back
        const existingRefunds = await this.razorpayService.fetchRefunds(finalInvoice.rzpPaymentId);
        const matchedRefund = existingRefunds.find(r => 
          r.amount === razorpayRefund && 
          r.notes?.bookingId === booking.id
        );

        if (matchedRefund) {
          this.logger.warn(`Refund already exists on Razorpay (ID: ${matchedRefund.refundId}). Reconciling DB.`);
          
          await tx.transaction.create({
            data: {
              customerId,
              bookingId: booking.id,
              paymentMethod: PaymentMethod.ONLINE,
              amount: razorpayRefund,
              type: TransactionType.DEBIT,
              category: TransactionCategory.BOOKING_REFUND,
              description: `Refund for cancelled Booking #${booking.bookingNumber}`,
            },
          });
          return;
        }

        await this.razorpayService.createRefund({
          paymentId: finalInvoice.rzpPaymentId,
          amount: razorpayRefund,
          notes: {
            bookingId: booking.id,
            reason: reason || 'Booking cancelled',
          },
        });

        await tx.transaction.create({
          data: {
            customerId,
            bookingId: booking.id,
            paymentMethod: PaymentMethod.ONLINE,
            amount: razorpayRefund,
            type: TransactionType.DEBIT,
            category: TransactionCategory.BOOKING_REFUND,
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
   * Process driver compensation for cancellation
   */
  private async processDriverCompensation(
    booking: Booking,
    assignedDriver: Driver,
    cancellationCharge: number,
    tx: Prisma.TransactionClient,
  ): Promise<{ driverCompensation: number; driverId: string }> {
    
    const driverCompensation = truncate2(cancellationCharge);
    const driverWalletBefore = Number(assignedDriver.walletBalance);
    const newDriverWalletBalance = truncate2(driverWalletBefore + driverCompensation);
      
    await tx.driver.update({
      where: { id: assignedDriver.id },
      data: { walletBalance: newDriverWalletBalance },
    });
      
    await tx.driverWalletLog.create({
      data: {
        driverId: assignedDriver.id,
        beforeBalance: driverWalletBefore,
        afterBalance: newDriverWalletBalance,
        amount: driverCompensation,
        reason: `Cancellation compensation for Booking #${booking.bookingNumber}`,
        bookingId: booking.id,
      },
    });
  
    return { driverCompensation, driverId: assignedDriver.id };
  }
}
