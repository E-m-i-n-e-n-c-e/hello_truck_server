import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { AssignmentStatus, DriverStatus, BookingStatus, BookingAssignment, Booking, Prisma, Invoice, Driver } from '@prisma/client';
import { AssignmentService } from '../assignment/assignment.service';
import { FirebaseService } from 'src/firebase/firebase.service';
import { FcmEventType } from 'src/common/types/fcm.types';
import { BookingInvoiceService } from './booking-invoice.service';
import { truncate2 } from '../utils/general.utils';

@Injectable()
export class BookingDriverService {

  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingAssignmentService: AssignmentService,
    private readonly firebase: FirebaseService,
    private readonly invoiceService: BookingInvoiceService,
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

    await this.prisma.$transaction(async (tx) => {
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

      await this.invoiceService.createFinalInvoice(
        {
          ...assignment.booking,
          customer: assignment.booking.customer!,
        },
        assignment.driver.vehicle!.vehicleModel,
        tx
      );

      await this.bookingAssignmentService.onDriverAccept(assignment.booking.id, assignment.driver.id);
    });
    if (!assignment.booking.customerId) return;
    this.firebase.notifyAllSessions(assignment.booking.customerId, 'customer', {
      notification: {
        title: 'Booking Confirmed',
        body: `Your booking has been confirmed. Your driver ${assignment.driver.firstName ?? ''} ${assignment.driver.lastName ?? ''} is on the way to pick up your parcel.`.trim(),
      },
      data: {
        event: FcmEventType.BookingStatusChange,
      },
    });
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
    if (!assignment.booking.customerId) return;
    this.firebase.notifyAllSessions(assignment.booking.customerId, 'customer', {
      data: {
        event: FcmEventType.BookingStatusChange,
      },
    });
  }

  async getDriverAssignment(driverId: string, tx: Prisma.TransactionClient = this.prisma): Promise<BookingAssignment & { driver: Driver; booking: Booking & { invoices: Invoice[] } } | null> {
    return tx.bookingAssignment.findFirst({
      where: {
        driverId,
        status: { in: [AssignmentStatus.OFFERED, AssignmentStatus.ACCEPTED] },
        booking: {
          status: { not: BookingStatus.COMPLETED }
        }
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
    if (!assignment.booking.customerId) return;
    this.firebase.notifyAllSessions(assignment.booking.customerId, 'customer', {
      notification: {
        title: 'Parcel Pickup Arrived',
        body: 'Your driver has arrived at the pickup location. Please verify the pickup and proceed with the delivery.',
      },
      data: {
        event: FcmEventType.BookingStatusChange,
      },
    });
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
    if (!assignment.booking.customerId) return;
    this.firebase.notifyAllSessions(assignment.booking.customerId, 'customer', {
      notification: {
        title: 'Parcel Drop Arrived',
        body: 'Your parcel has arrived at the drop location. Please verify the drop and proceed with the delivery.',
      },
      data: {
        event: FcmEventType.BookingStatusChange,
      },
    });
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
    if (!assignment.booking.customerId) return;
    this.firebase.notifyAllSessions(assignment.booking.customerId, 'customer', {
      notification: {
        title: 'Parcel Pickup Verified',
        body: 'Your parcel has been picked up and is on its way to the drop location.',
      },
      data: {
        event: FcmEventType.BookingStatusChange,
      },
    });
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
    if (!assignment.booking.customerId) return;
    this.firebase.notifyAllSessions(assignment.booking.customerId, 'customer', {
      notification: {
        title: 'Parcel Drop Verified',
        body: 'Your parcel has been dropped off at the destination.',
      },
      data: {
        event: FcmEventType.BookingStatusChange,
      },
    });
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
    if (!assignment.booking.customerId) return;
    this.firebase.notifyAllSessions(assignment.booking.customerId, 'customer', {
      notification: {
        title: 'Ride Started',
        body: 'Driver has started the ride. Please sit back and relax as your parcel is being delivered.',
      },
      data: {
        event: FcmEventType.BookingStatusChange,
      },
    });
  }

  async finishRide(driverId: string): Promise<void> {
    let walletChange = 0;
    let isCashPayment = false;
    
    const assignment = await this.prisma.$transaction(async (tx) => {
      const assignment = await this.getDriverAssignment(driverId, tx);
      if (!assignment) {
        throw new NotFoundException(`No pending assignment found for driver ${driverId}`);
      }

      // Get final invoice to calculate driver earnings
      const finalInvoice = assignment.booking.invoices.find(invoice => invoice.type === 'FINAL');

      if (!finalInvoice || !finalInvoice.isPaid) {
        throw new BadRequestException('Booking payment must be completed before finishing ride');
      }

      const totalAmount = Number(finalInvoice.finalAmount);
      const commissionRate = this.configService.get<number>('COMMISSION_RATE')!;
      const commission = Math.round(totalAmount * commissionRate * 100) / 100;
      
      // Check payment type
      isCashPayment = finalInvoice.rzpPaymentId === 'CASH';
      
      // Get current driver wallet balance
      const driver = assignment.driver;
      const currentBalance = Number(driver.walletBalance);
      let newBalance: number;
      let walletLogReason: string;

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

      return assignment;
    });
    
    
    if(walletChange !== 0){
      // Notify driver based on payment type
      this.firebase.notifyAllSessions(driverId, 'driver', {
        notification: {
          title: 'Ride Completed',
          body: isCashPayment
            ? `₹${Math.abs(walletChange).toFixed(2)} commission deducted from wallet for cash payment`
            : `₹${walletChange.toFixed(2)} earnings credited to your wallet`,
        },
        data: {
          event: isCashPayment ? FcmEventType.WalletDebit : FcmEventType.WalletCredit,
        },
      });
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

    // Simply mark invoice as paid (cash)
    await this.prisma.invoice.update({
      where: { id: finalInvoice.id },
      data: {
        isPaid: true,
        paidAt: new Date(),
        rzpPaymentId: 'CASH',
      },
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
            dropAddress: true,
          },
        },
      },
      orderBy: { offeredAt: 'desc' },
      take: 10,
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
