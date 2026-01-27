/**
 * Support Module
 *
 * Customer Support Dashboard for:
 * - Searching bookings by phone/ID
 * - Viewing customer/driver metadata
 * - Fetching live driver location
 * - Managing support notes
 */
import { Module } from '@nestjs/common';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [PrismaModule, RedisModule, AuditLogModule],
  controllers: [SupportController],
  providers: [SupportService],
  exports: [SupportService],
})
export class SupportModule {}
