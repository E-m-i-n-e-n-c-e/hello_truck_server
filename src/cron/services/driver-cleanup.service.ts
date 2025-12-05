import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DriverStatus } from '@prisma/client';

@Injectable()
export class DriverCleanupService {
  constructor(private prisma: PrismaService) {}

  async resetDriverAvailability() {
    const result = await this.prisma.driver.updateMany({
      where: {
        driverStatus: DriverStatus.AVAILABLE,
      },
      data: {
        driverStatus: DriverStatus.UNAVAILABLE
      }
    });
    console.log(`Reset ${result.count} drivers to UNAVAILABLE at midnight`);
  }
}
