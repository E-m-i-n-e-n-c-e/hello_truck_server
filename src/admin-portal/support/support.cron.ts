import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AdminRefundStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminSupportService } from './services/admin-support.service';

@Injectable()
export class SupportCron {
  private readonly logger = new Logger(SupportCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly adminSupportService: AdminSupportService,
  ) {}

  @Cron(CronExpression.EVERY_2_HOURS)
  async handleExpiredBufferRefunds() {
    this.logger.log('Running support refund finalization cron job...');

    try {
      const expiredRefunds = await this.prisma.adminRefundRequest.findMany({
        where: {
          status: AdminRefundStatus.APPROVED,
          bufferExpiresAt: {
            lte: new Date(),
          },
        },
        select: {
          id: true,
        },
        take: 50,
      });

      if (expiredRefunds.length === 0) {
        this.logger.debug('No expired refund buffers found');
        return;
      }

      let finalized = 0;
      let failed = 0;

      for (const refund of expiredRefunds) {
        try {
          await this.adminSupportService.finalizeRefund(refund.id);
          finalized++;
        } catch (error) {
          this.logger.error(`Failed to finalize refund ${refund.id}`, error);
          failed++;
        }
      }

      this.logger.log(`Support refund finalization complete: ${finalized} finalized, ${failed} failed`);
    } catch (error) {
      this.logger.error('Support refund finalization cron job failed', error);
    }
  }
}
