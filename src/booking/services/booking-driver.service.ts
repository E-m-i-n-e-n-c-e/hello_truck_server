import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AssignmentStatus, DriverStatus, BookingStatus, BookingAssignment, Booking, Prisma } from '@prisma/client';
import { AssignmentService } from '../assignment/assignment.service';

@Injectable()
export class BookingDriverService {

  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingAssignmentService: AssignmentService,
  ) { }

  async acceptBooking(driverAssignmentId: string): Promise<void> {
    // Check if assignment exists and is in OFFERED status
    const assignment = await this.prisma.bookingAssignment.findUnique({
      where: { id: driverAssignmentId, status: AssignmentStatus.OFFERED },
      include: {
        booking: true,
        driver: true
      }
    });

    if (!assignment) {
      throw new NotFoundException(`No pending offer found for driver assignment ${driverAssignmentId}`);
    }

    if (assignment.booking.status !== BookingStatus.DRIVER_ASSIGNED) {
      throw new BadRequestException(`Cannot accept booking in ${assignment.booking.status} status`);
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
        data: { status: BookingStatus.CONFIRMED }
      });

      // Update driver status to ON_RIDE
      await tx.driver.update({
        where: { id: assignment.driver.id },
        data: { driverStatus: DriverStatus.ON_RIDE }
      });

      await this.bookingAssignmentService.onDriverAccept(assignment.booking.id, assignment.driver.id);
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
  }

  async getDriverAssignment(driverId: string, tx: Prisma.TransactionClient = this.prisma): Promise<BookingAssignment & { booking: Booking } | null> {
    return tx.bookingAssignment.findFirst({
      where: { driverId, status: { in: [AssignmentStatus.OFFERED, AssignmentStatus.ACCEPTED] } },
      include: {
        booking: {
          include: {
            package: true,
            pickupAddress: true,
            dropAddress: true,
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
      where: { id: assignment.booking.id, status: BookingStatus.PICKUP_ARRIVED },
      data: { status: BookingStatus.PICKUP_VERIFIED }
    });
  }

  async dropArrived(driverId: string): Promise<void> {
    const assignment = await this.getDriverAssignment(driverId);
    if (!assignment) {
      throw new NotFoundException(`No pending assignment found for driver ${driverId}`);
    }
    await this.prisma.booking.update({
      where: { id: assignment.booking.id, status: BookingStatus.DROP_ARRIVED },
      data: { status: BookingStatus.DROP_VERIFIED }
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
      where: { id: assignment.booking.id },
      data: { status: BookingStatus.PICKUP_VERIFIED }
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
      where: { id: assignment.booking.id },
      data: { status: BookingStatus.DROP_VERIFIED }
    });
  }

  async startRide(driverId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.driver.update({
        where: { id: driverId },
        data: { driverStatus: DriverStatus.ON_RIDE }
      });
      const assignment = await this.getDriverAssignment(driverId, tx);
      if (!assignment) {
        throw new NotFoundException(`No pending assignment found for driver ${driverId}`);
      }
      await tx.booking.update({
          where: { id: assignment.booking.id, status: BookingStatus.PICKUP_VERIFIED },
          data: { status: BookingStatus.IN_TRANSIT }
        });
    });
  }

  async finishRide(driverId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.driver.update({
        where: { id: driverId },
        data: { driverStatus: DriverStatus.AVAILABLE }
      });
      const assignment = await this.getDriverAssignment(driverId, tx);
      if (!assignment) {
        throw new NotFoundException(`No pending assignment found for driver ${driverId}`);
      }
      await tx.booking.update({
        where: { id: assignment.booking.id, status: BookingStatus.DROP_VERIFIED },
        data: { status: BookingStatus.COMPLETED }
      });
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
}
