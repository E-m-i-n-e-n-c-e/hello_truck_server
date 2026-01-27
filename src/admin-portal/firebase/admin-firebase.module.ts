/**
 * Admin Firebase Module
 *
 * Provides Firebase functionality for admin portal:
 * - FCM notifications to drivers/customers
 * - Storage operations (log archival)
 *
 * This is separate from main app's FirebaseModule to allow
 * admin portal to run independently (APP_MODE=admin).
 */
import { Module, Global } from '@nestjs/common';
import { AdminFirebaseService } from './admin-firebase.service';

@Global()
@Module({
  providers: [AdminFirebaseService],
  exports: [AdminFirebaseService],
})
export class AdminFirebaseModule {}
