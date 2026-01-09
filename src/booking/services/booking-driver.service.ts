import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { AssignmentStatus, DriverStatus, BookingStatus, BookingAssignment, Booking, Prisma, Invoice, Driver, PaymentMethod, Package, Address, Customer } from '@prisma/client';
import { AssignmentService } from '../assignment/assignment.service';
import { BookingInvoiceService } from './booking-invoice.service';
import { BookingPaymentService } from './booking-payment.service';
import { BookingNotificationService } from './booking-notification.service';
import { RazorpayService } from 'src/razorpay/razorpay.service';
import { truncate2 } from '../utils/general.utils';
import { toDecimal, toNumber, truncateDecimal } from '../utils/decimal.utils';

type BookingWithRelations = Booking & {
  package: Package;
  pickupAddress: Address;
  dropAddress: Address;
  customer: Customer | null;
  invoices: Invoice[];
}

type AssignmentWithRelations = BookingAssignment & {
  driver: Driver;
  booking: BookingWithRelations;
}

@Injectable()
export class BookingDriverService {
  private readonly logger = new Logger(BookingDriverService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingAssignmentService: AssignmentService,
    private readonly invoiceService: BookingInvoiceService,
    private readonly paymentService: BookingPaymentService,
    private readonly notificationService: BookingNotificationService,
    private readonly configService: ConfigService,
    private readonly razorpayService: RazorpayService,
  ) { }

  async acceptBooking(driverAssignmentId: string): Promise<void> {
    // Check if assignment exists and is in OFFERED status
    const assignment = await this.prisma.bookingAssignment.findUnique({
      where: { id: driverAssignmentId, status: AssignmentStatus.OFFERED },
      include: {
        booking: {
          include: {
            package: true,
            pickupAddress: true,
            dropAddress: true,
            customer: true,
          }
        },
        driver: {
          include: {
            vehicle: {
              include: {
                vehicleModel: true,
              },
            },
          }
        }
      }
    });

    if (!assignment) {
      throw new NotFoundException(`No pending offer found for driver assignment ${driverAssignmentId}`);
    }

    if (assignment.booking.status !== BookingStatus.DRIVER_ASSIGNED) {
      throw new BadRequestException(`Cannot accept booking in ${assignment.booking.status} status`);
    }

    if (!assignment.driver.vehicle) {
      throw new BadRequestException('Driver does not have a vehicle');
    }

    if (!assignment.booking.customer) {
      throw new BadRequestException('Booking does not have a customer');
    }

    const walletData = await this.prisma.$transaction(async (tx) => {
      // Get current commission rate to store with assignment
      const commissionRate = this.configService.get<number>('COMMISSION_RATE') || 0.07;

      // Update assignment status to ACCEPTED with commission rate snapshot
      await tx.bookingAssignment.updateMany({
        where: { id: assignment.id, status: AssignmentStatus.OFFERED },
        data: {
          status: AssignmentStatus.ACCEPTED,
          respondedAt: new Date(),
          commissionRate: commissionRate,
        }
      });

      // Update booking status to CONFIRMED
      await tx.booking.update({
        where: { id: assignment.booking.id },
        data: { status: BookingStatus.CONFIRMED, acceptedAt: new Date() }
      });

      // Update driver status to ON_RIDE
      await tx.driver.update({
        where: { id: assignment.driver.id },
        data: { driverStatus: DriverStatus.ON_RIDE }
      });

      const invoice = await this.invoiceService.createFinalInvoice(
        {
          ...assignment.booking,
          customer: assignment.booking.customer!,
        },
        assignment.driver.vehicle!.vehicleModel,
        tx
      );

      return {
        invoice,
        walletApplied: Number(invoice.walletApplied),
        customerId: assignment.booking.customerId,
        booking: assignment.booking,
      };
    });

    this.bookingAssignmentService.onDriverAccept(assignment.booking.id, assignment.driver.id);

    // Send wallet notifications (fire-and-forget, outside transaction)
    if (walletData.walletApplied !== 0 && walletData.customerId) {
      if (walletData.walletApplied > 0) {
        this.notificationService.notifyCustomerWalletApplied(walletData.customerId, walletData.walletApplied);
      } else {
        this.notificationService.notifyCustomerWalletDebtCleared(walletData.customerId, walletData.walletApplied);
      }
    }

    // Send booking confirmed notification (fire-and-forget, outside transaction)
    if (assignment.booking.customerId) {
      this.notificationService.notifyCustomerBookingConfirmed(
        assignment.booking.customerId,
        assignment.driver.firstName,
        assignment.driver.lastName,
      );
    }

    if (Number(walletData.invoice.finalAmount) > 0 && !walletData.invoice.isPaid) {
      this.invoiceService.createPaymentLinkForInvoice(
        walletData.invoice,
        { ...walletData.booking, customer: assignment.booking.customer! }
      ).catch(error => {
        this.logger.error(`Async payment link creation failed for invoice ${walletData.invoice.id}: ${error.message}`);
      });
    }
  }


  async rejectBooking(driverAssignmentId: string): Promise<void> {
    // Check if assignment exists and is in OFFERED status
    const assignment = await this.prisma.bookingAssignment.findUnique({
      where: { id: driverAssignmentId },
      include: {
        booking: true,
        driver: true
      }
    });

    if (!assignment) {
      throw new NotFoundException(`No pending offer found for driver assignment ${driverAssignmentId}`);
    }

    // Update assignment status to REJECTED
    await this.prisma.$transaction(async (tx) => {
      // Update assignment status to REJECTED
      await tx.bookingAssignment.update({
        where: { id: assignment.id },
        data: {
          status: AssignmentStatus.REJECTED,
          respondedAt: new Date()
        }
      });

      // Update booking status back to PENDING (so another driver can be assigned)
      await tx.booking.update({
        where: { id: assignment.booking.id },
        data: {
          status: BookingStatus.PENDING,
          assignedDriverId: null // Remove driver assignment
        }
      });

      // Update driver status back to AVAILABLE
      await tx.driver.update({
        where: { id: assignment.driver.id },
        data: { driverStatus: DriverStatus.AVAILABLE }
      });

      await this.bookingAssignmentService.onDriverReject(assignment.booking.id, assignment.driver.id);
    });

    // Send notification (fire-and-forget, outside transaction)
    if (assignment.booking.customerId) {
      this.notificationService.notifyBookingStatusChange(
        assignment.booking.customerId,
        'customer',
        BookingStatus.PENDING
      );
    }
  }

  async getDriverAssignment(driverId: string, tx: Prisma.TransactionClient = this.prisma): Promise<AssignmentWithRelations | null> {
    return tx.bookingAssignment.findFirst({
      where: {
        driverId,
        status: { in: [AssignmentStatus.OFFERED, AssignmentStatus.ACCEPTED] },
        booking: {
          status: { notIn: [BookingStatus.COMPLETED, BookingStatus.CANCELLED, BookingStatus.EXPIRED] }
        }
      },
      orderBy: {
        offeredAt: 'desc', // Get most recent assignment first
      },
      include: {
        driver: true,
        booking: {
          include: {
            package: true,
            pickupAddress: true,
            dropAddress: true,
            customer: true,
            invoices: true,
          },
        },
      }
    });
  }

  async pickupArrived(driverId: string): Promise<void> {
    const assignment = await this.getDriverAssignment(driverId);
    if (!assignment) {
      throw new NotFoundException(`No pending assignment found for driver ${driverId}`);
    }
    await this.prisma.booking.update({
      where: {
        id: assignment.booking.id,
        status: BookingStatus.CONFIRMED,
      },
      data: { status: BookingStatus.PICKUP_ARRIVED, pickupArrivedAt: new Date() }
    });

    // Send notification (fire-and-forget, outside transaction)
    if (assignment.booking.customerId) {
      this.notificationService.notifyCustomerPickupArrived(assignment.booking.customerId);
    }
  }

  async dropArrived(driverId: string): Promise<void> {
    const assignment = await this.getDriverAssignment(driverId);
    if (!assignment) {
      throw new NotFoundException(`No pending assignment found for driver ${driverId}`);
    }
    await this.prisma.booking.update({
      where: {
        id: assignment.booking.id,
        status: { in: [BookingStatus.PICKUP_VERIFIED, BookingStatus.IN_TRANSIT ] }
      },
      data: { status: BookingStatus.DROP_ARRIVED, dropArrivedAt: new Date() }
    });

    // Send notification (fire-and-forget, outside transaction)
    if (assignment.booking.customerId) {
      this.notificationService.notifyCustomerDropArrived(assignment.booking.customerId);
    }
  }

  async verifyPickup(driverId: string, pickupOtp: string): Promise<void> {
    const assignment = await this.getDriverAssignment(driverId);
    if (!assignment) {
      throw new NotFoundException(`No pending assignment found for driver ${driverId}`);
    }
    if (assignment.booking.pickupOtp !== pickupOtp) {
      throw new BadRequestException('Invalid OTP');
    }
    const finalInvoice = assignment.booking.invoices.find(invoice => invoice.type === 'FINAL');
    if (!finalInvoice || !finalInvoice.isPaid || !finalInvoice.paymentMethod ) {
      throw new BadRequestException('Booking payment must be completed before verifying pickup');
    }
    await this.prisma.booking.update({
      where: {
        id: assignment.booking.id,
        status: { in: [BookingStatus.CONFIRMED, BookingStatus.PICKUP_ARRIVED] }
      },
      data: { status: BookingStatus.PICKUP_VERIFIED, pickupVerifiedAt: new Date() }
    });

    // Send notification (fire-and-forget, outside transaction)
    if (assignment.booking.customerId) {
      this.notificationService.notifyCustomerPickupVerified(assignment.booking.customerId);
    }
  }

  async verifyDrop(driverId: string, dropOtp: string): Promise<void> {
    const assignment = await this.getDriverAssignment(driverId);
    if (!assignment) {
      throw new NotFoundException(`No pending assignment found for driver ${driverId}`);
    }
    if (assignment.booking.dropOtp !== dropOtp) {
      throw new BadRequestException('Invalid OTP');
    }
    await this.prisma.booking.update({
      where: {
        id: assignment.booking.id,
        status: { in: [BookingStatus.PICKUP_VERIFIED, BookingStatus.IN_TRANSIT, BookingStatus.DROP_ARRIVED] }
      },
      data: { status: BookingStatus.DROP_VERIFIED, dropVerifiedAt: new Date() }
    });

    // Send notification (fire-and-forget, outside transaction)
    if (assignment.booking.customerId) {
      this.notificationService.notifyCustomerDropVerified(assignment.booking.customerId);
    }
  }

  async startRide(driverId: string): Promise<void> {
    const assignment = await this.getDriverAssignment(driverId);
    if (!assignment) {
      throw new NotFoundException(`No pending assignment found for driver ${driverId}`);
    }
    await this.prisma.booking.update({
        where: { id: assignment.booking.id, status: BookingStatus.PICKUP_VERIFIED },
        data: { status: BookingStatus.IN_TRANSIT }
      });

    // Send notification (fire-and-forget, outside transaction)
    if (assignment.booking.customerId) {
      this.notificationService.notifyCustomerRideStarted(assignment.booking.customerId);
    }
  }

  async finishRide(driverId: string): Promise<void> {
    const { walletChange, isCashPayment, customerId } = await this.prisma.$transaction(async (tx) => {
      const assignment = await this.getDriverAssignment(driverId, tx);
      if (!assignment) {
        throw new NotFoundException(`No pending assignment found for driver ${driverId}`);
      }

      // Get final invoice to calculate driver earnings
      const finalInvoice = assignment.booking.invoices.find(invoice => invoice.type === 'FINAL');

      if (!finalInvoice || !finalInvoice.isPaid || !finalInvoice.paymentMethod ) {
        throw new BadRequestException('Booking payment must be completed before finishing ride');
      }

      // Use Decimal for precision calculations
      // totalPrice = full service cost (commission calculated on this)
      const totalPrice = toDecimal(finalInvoice.totalPrice);
      // Use stored commission rate from assignment if available, fallback to env config
      const storedRate = assignment.commissionRate;
      const commissionRate = storedRate
        ? toDecimal(storedRate)
        : toDecimal(this.configService.get<number>('COMMISSION_RATE')!);
      const commission = truncateDecimal(totalPrice.mul(commissionRate));

      // Check payment type
      const isCashPayment = finalInvoice.paymentMethod === PaymentMethod.CASH;

      // Get current driver wallet balance
      const driver = assignment.driver;
      const currentBalance = toDecimal(driver.walletBalance);
      let newBalance: number;
      let walletLogReason: string;
      let walletChange: number;

      if (isCashPayment) {
        // Cash payment: Driver collected finalAmount in cash
        // walletChange = driverEarnings - cashCollected = (totalPrice - commission) - finalAmount
        // Simplifies to: walletChange = walletApplied - commission
        // - If walletApplied > 0: Customer used wallet credit, driver got less cash → platform compensates
        // - If walletApplied < 0: Customer had debt, driver collected extra → driver owes platform
        // - If walletApplied = 0: Simple commission deduction
        const walletApplied = toDecimal(finalInvoice.walletApplied);
        const walletChangeDecimal = truncateDecimal(walletApplied.minus(commission));
        walletChange = toNumber(walletChangeDecimal);
        newBalance = toNumber(truncateDecimal(currentBalance.plus(walletChangeDecimal)));

        if (walletApplied.isZero()) {
          // Simple case: no wallet adjustment, just commission
          walletLogReason = `Commission for cash payment - Booking #${assignment.booking.bookingNumber}`;
        } else if (walletChangeDecimal.greaterThanOrEqualTo(0)) {
          // Wallet credit compensated driver
          walletLogReason = `Earnings adjustment for Booking #${assignment.booking.bookingNumber}`;
        } else {
          // Commission + debt recovery deducted
          walletLogReason = `Commission + wallet adjustment for Booking #${assignment.booking.bookingNumber}`;
        }
      } else {
        // Online payment: Driver gets net earnings (CREDIT)
        const driverEarnings = truncateDecimal(totalPrice.minus(commission));
        walletChange = toNumber(driverEarnings);
        newBalance = toNumber(truncateDecimal(currentBalance.plus(driverEarnings)));
        walletLogReason = `Earnings from Booking #${assignment.booking.bookingNumber}`;
      }

      // Update driver status and wallet
      await tx.driver.update({
        where: { id: driverId },
        data: {
          driverStatus: DriverStatus.AVAILABLE,
          walletBalance: newBalance,
        },
      });

      // Log wallet change
      await tx.driverWalletLog.create({
        data: {
          driverId,
          beforeBalance: currentBalance,
          afterBalance: newBalance,
          amount: walletChange,
          reason: walletLogReason,
          bookingId: assignment.booking.id,
        },
      });

      // Complete the booking
      await tx.booking.update({
        where: { id: assignment.booking.id, status: BookingStatus.DROP_VERIFIED },
        data: { status: BookingStatus.COMPLETED, completedAt: new Date() },
      });

      return { walletChange, isCashPayment, customerId: assignment.booking.customerId };
    });

    // Send notifications (fire-and-forget, outside transaction)
    if (walletChange !== 0) {
      this.notificationService.notifyDriverWalletChange(
        driverId,
        walletChange,
        isCashPayment,
      );
    }

    // Notify customer that ride is completed
    if (customerId) {
      this.notificationService.notifyCustomerRideCompleted(customerId);
    }
  }

  async settleWithCash(driverId: string): Promise<void> {
    const assignment = await this.getDriverAssignment(driverId);
    if (!assignment) {
      throw new NotFoundException(`No pending assignment found for driver ${driverId}`);
    }

    // Get final invoice
    const finalInvoice = assignment.booking.invoices.find(invoice => invoice.type === 'FINAL');

    if (!finalInvoice) {
      throw new BadRequestException('Final invoice not found');
    }

    if (finalInvoice.isPaid) {
      throw new BadRequestException('Payment already received');
    }

    // Process cash payment (handles transaction, notifications, and payment link cancellation)
    await this.paymentService.processCashPayment(
      finalInvoice,
      assignment.booking,
    );
  }

  async getAssignmentHistory(driverId: string) {
    return this.prisma.bookingAssignment.findMany({
      where: {
        driverId,
        status: AssignmentStatus.ACCEPTED,
        booking: {
          status: BookingStatus.COMPLETED,
        },
      },
      include: {
        booking: {
          include: {
            package: true,
            pickupAddress: true,
            invoices: true,
            dropAddress: true,
          },
        },
      },
      orderBy: { offeredAt: 'desc' },
      take: 30,
    });
  }

  async getRideSummary(driverId: string, date?: string): Promise<{
    totalRides: number;
    netEarnings: number;
    commissionRate: number;
    date: string;
    assignments: BookingAssignment[];
  }> {
    // Parse input date or use today in IST
    const inputDate = date || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD in IST

    // Create UTC timestamps for IST day boundaries
    // When Date parses '2025-01-01T00:00:00+05:30', it automatically converts to UTC (2024-12-31T18:30:00Z)
    const startUTC = new Date(`${inputDate}T00:00:00+05:30`);
    const endUTC = new Date(`${inputDate}T23:59:59.999+05:30`);

    // Get default commission rate from config (used for display and fallback)
    const defaultCommissionRate = this.configService.get<number>('COMMISSION_RATE')!;

    // Query DB with UTC timestamps, filter FINAL invoices at DB level
    const completedAssignments = await this.prisma.bookingAssignment.findMany({
      where: {
        driverId,
        status: AssignmentStatus.ACCEPTED,
        booking: {
          status: BookingStatus.COMPLETED,
          completedAt: {
            gte: startUTC,
            lte: endUTC,
          },
          invoices: {
            some: { type: 'FINAL' },
          },
        },
      },
      include: {
        booking: {
          include: {
            package: true,
            pickupAddress: true,
            dropAddress: true,
            invoices: {
              where: { type: 'FINAL' },
            },
          },
        },
      },
      orderBy: {
        booking: {
          completedAt: 'desc',
        },
      },
    });

    // Calculate total earnings (gross) and net earnings (after commission) using Decimal for precision
    let totalGrossEarnings = toDecimal(0);
    let totalNetEarnings = toDecimal(0);

    completedAssignments.forEach((assignment) => {
      const finalInvoice = assignment.booking.invoices[0];
      if (finalInvoice) {
        // Use totalPrice (full service cost) for commission calculation
        // NOT finalAmount (which is after wallet deduction)
        const grossAmount = toDecimal(finalInvoice.totalPrice);
        // Use stored commission rate from assignment if available, fallback to default
        const assignmentCommissionRate = assignment.commissionRate
          ? toDecimal(assignment.commissionRate)
          : toDecimal(defaultCommissionRate);
        const commission = truncateDecimal(grossAmount.mul(assignmentCommissionRate));
        const netAmount = truncateDecimal(grossAmount.minus(commission));

        totalGrossEarnings = totalGrossEarnings.plus(grossAmount);
        totalNetEarnings = totalNetEarnings.plus(netAmount);
      }
    });

    return {
      totalRides: completedAssignments.length,
      netEarnings: toNumber(truncateDecimal(totalNetEarnings)), // Driver's earnings after commission
      commissionRate: defaultCommissionRate, // Platform commission rate (e.g., 0.07 for 7%)
      date: inputDate, // Return in YYYY-MM-DD format (IST date)
      assignments: completedAssignments, // Return completed assignments with bookings
    };
  }
}
