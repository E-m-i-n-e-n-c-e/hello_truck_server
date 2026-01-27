/**
 * Admin Notifications Module
 */
import { Module } from '@nestjs/common';
import { AdminNotificationsController } from './admin-notifications.controller';
import { AdminNotificationsService } from './admin-notifications.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminFirebaseModule } from '../firebase/admin-firebase.module';

@Module({
  imports: [PrismaModule, AdminFirebaseModule],
  controllers: [AdminNotificationsController],
  providers: [AdminNotificationsService],
  exports: [AdminNotificationsService],
})
export class AdminNotificationsModule {}
