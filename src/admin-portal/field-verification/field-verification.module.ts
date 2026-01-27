/**
 * Field Verification Module
 *
 * For Field Agents to:
 * - View assigned verifications
 * - View driver/vehicle documents
 * - Upload vehicle photos
 * - Complete field verification
 */
import { Module } from '@nestjs/common';
import { FieldVerificationController } from './field-verification.controller';
import { FieldVerificationService } from './field-verification.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [PrismaModule, AuditLogModule],
  controllers: [FieldVerificationController],
  providers: [FieldVerificationService],
  exports: [FieldVerificationService],
})
export class FieldVerificationModule {}
