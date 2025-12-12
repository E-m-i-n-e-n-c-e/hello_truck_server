import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DriverStatus } from '@prisma/client';
import { Logger } from '@nestjs/common';

@Injectable()
export class DriverCleanupService {
  private readonly logger = new Logger(DriverCleanupService.name);
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
    this.logger.log(`Reset ${result.count} drivers to UNAVAILABLE at midnight`);
  }
}
