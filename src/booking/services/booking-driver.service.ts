import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { AssignmentStatus, DriverStatus, BookingStatus, BookingAssignment, Booking, Prisma, Invoice, Driver, PaymentMethod } from '@prisma/client';
import { AssignmentService } from '../assignment/assignment.service';
import { BookingInvoiceService } from './booking-invoice.service';
import { BookingPaymentService } from './booking-payment.service';
import { BookingNotificationService } from './booking-notification.service';
import { truncate2 } from '../utils/general.utils';

@Injectable()
export class BookingDriverService {

  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingAssignmentService: AssignmentService,
    private readonly invoiceService: BookingInvoiceService,
    private readonly paymentService: BookingPaymentService,
    private readonly notificationService: BookingNotificationService,
    private readonly configService: ConfigService,
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
      // Update assignment status to ACCEPTED
      await tx.bookingAssignment.updateMany({
        where: { id: assignment.id, status: AssignmentStatus.OFFERED },
        data: {
          status: AssignmentStatus.ACCEPTED,
          respondedAt: new Date()
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

      await this.bookingAssignmentService.onDriverAccept(assignment.booking.id, assignment.driver.id);
      
      return { walletApplied: Number(invoice.walletApplied), customerId: assignment.booking.customerId };
    });
    
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
      this.notificationService.notifyCustomerBookingStatusChange(
        assignment.booking.customerId,
      );
    }
  }

  async getDriverAssignment(driverId: string, tx: Prisma.TransactionClient = this.prisma): Promise<BookingAssignment & { driver: Driver; booking: Booking & { invoices: Invoice[] } } | null> {
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
    const { walletChange, isCashPayment } = await this.prisma.$transaction(async (tx) => {
      const assignment = await this.getDriverAssignment(driverId, tx);
      if (!assignment) {
        throw new NotFoundException(`No pending assignment found for driver ${driverId}`);
      }

      // Get final invoice to calculate driver earnings
      const finalInvoice = assignment.booking.invoices.find(invoice => invoice.type === 'FINAL');

      if (!finalInvoice || !finalInvoice.isPaid || !finalInvoice.paymentMethod ) {
        throw new BadRequestException('Booking payment must be completed before finishing ride');
      }

      const totalAmount = Number(finalInvoice.finalAmount);
      const commissionRate = this.configService.get<number>('COMMISSION_RATE')!;
      const commission = Math.round(totalAmount * commissionRate * 100) / 100;
      
      // Check payment type
      const isCashPayment = finalInvoice.paymentMethod === PaymentMethod.CASH;
      
      // Get current driver wallet balance
      const driver = assignment.driver;
      const currentBalance = Number(driver.walletBalance);
      let newBalance: number;
      let walletLogReason: string;
      let walletChange: number;

      if (isCashPayment) {
        // Cash payment: Driver received cash, owes commission to platform (DEBIT)
        walletChange = truncate2(-commission);
        newBalance = truncate2(currentBalance - commission);
        walletLogReason = `Commission for cash payment - Booking #${assignment.booking.bookingNumber} (${commissionRate * 100}%)`;
      } else {
        // Online payment: Driver gets net earnings (CREDIT)
        const driverEarnings = truncate2(totalAmount - commission);
        walletChange = driverEarnings;
        newBalance = truncate2(currentBalance + driverEarnings);
        walletLogReason = `Earnings from Booking #${assignment.booking.bookingNumber} (${commissionRate * 100}% commission deducted)`;
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
      
      return { walletChange, isCashPayment };
    });
    
    // Send notification (fire-and-forget, outside transaction)
    if (walletChange !== 0) {
      this.notificationService.notifyDriverWalletChange(
        driverId,
        walletChange,
        isCashPayment,
      );
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

    // Use payment service to handle cash payment processing
    await this.prisma.$transaction(async (tx) => {
      await this.paymentService.processCashPayment(
        finalInvoice,
        assignment.booking,
        tx,
      );
    });
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
    totalEarnings: number;
    date: string;
  }> {
    // Parse input date or use today in IST
    const inputDate = date || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD in IST
    
    // Create UTC timestamps for IST day boundaries
    // When Date parses '2025-01-01T00:00:00+05:30', it automatically converts to UTC (2024-12-31T18:30:00Z)
    const startUTC = new Date(`${inputDate}T00:00:00+05:30`);
    const endUTC = new Date(`${inputDate}T23:59:59.999+05:30`);

    // Query DB with UTC timestamps, filter FINAL invoices at DB level
    const completedBookings = await this.prisma.bookingAssignment.findMany({
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
            invoices: {
              where: { type: 'FINAL' },
              select: { finalAmount: true },
            },
          },
        },
      },
    });

    // Calculate total earnings
    const totalEarnings = completedBookings.reduce((sum, assignment) => {
      const finalInvoice = assignment.booking.invoices[0];
      return sum + (finalInvoice ? Number(finalInvoice.finalAmount) : 0);
    }, 0);

    return {
      totalRides: completedBookings.length,
      totalEarnings: Math.round(totalEarnings * 100) / 100,
      date: inputDate, // Return in YYYY-MM-DD format (IST date)
    };
  }
}
