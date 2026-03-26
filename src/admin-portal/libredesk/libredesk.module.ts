import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LibredeskService } from './libredesk.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminFirebaseModule } from '../firebase/admin-firebase.module';
import { AdminNotificationsModule } from '../notifications/admin-notifications.module';
import { LibredeskWebhookController } from './libredesk-webhook.controller';

@Module({
  imports: [ConfigModule, PrismaModule, AdminNotificationsModule],
  controllers: [LibredeskWebhookController],
  providers: [LibredeskService],
  exports: [LibredeskService],
})
export class LibredeskModule {}
