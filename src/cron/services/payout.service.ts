import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RazorpayXService } from '../../razorpay/razorpayx.service';
import { FirebaseService } from '../../firebase/firebase.service';
import { FcmEventType } from '../../common/types/fcm.types';
import { PaymentMethod } from '@prisma/client';

@Injectable()
export class PayoutService {
  private readonly logger = new Logger(PayoutService.name);
  
  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpayxService: RazorpayXService,
    private readonly firebaseService: FirebaseService,
  ) {}

  async processDailyPayouts() {
    this.logger.log('Starting daily payout processing');
    
    // Get all drivers with positive wallet balance
    const drivers = await this.prisma.driver.findMany({
      where: {
        walletBalance: { gt: 0 },
        fundAccountId: { not: null },
      },
    });
    
    this.logger.log(`Found ${drivers.length} drivers eligible for payout`);
    
    for (const driver of drivers) {
      // Wallet balance already has commission deducted (net amount)
      const payoutAmount = Number(driver.walletBalance);
      
      this.logger.log(`Processing payout for driver ${driver.id}: ₹${payoutAmount}`);
      
      const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const referenceId = `payout-${driver.id}-${todayStr}`;

      // Create payout via RazorpayX
      const payout = await this.razorpayxService.createPayout({
        fundAccountId: driver.fundAccountId!,
        amount: payoutAmount,
        currency: 'INR',
        mode: 'IMPS',
        purpose: 'payout',
        referenceId,
      });
      
      await this.prisma.$transaction(async (tx) => {
        // Deduct from driver wallet
        await tx.driver.update({
          where: { id: driver.id },
          data: { walletBalance: 0 },
        });
        
        // Log payout
        await tx.driverWalletLog.create({
          data: {
            driverId: driver.id,
            beforeBalance: payoutAmount,
            afterBalance: 0,
            amount: -payoutAmount,
            reason: 'Daily payout to bank account',
          },
        });
        
        // Create transaction record
        await tx.transaction.create({
          data: {
            driverId: driver.id,
            paymentMethod: PaymentMethod.ONLINE,
            amount: payoutAmount,
            type: 'DEBIT',
            category: 'DRIVER_PAYOUT',
            description: `Daily payout - ₹${payoutAmount.toFixed(2)}`,
          },
        });
        
        // Create payout record
        await tx.payout.create({
          data: {
            driverId: driver.id,
            amount: payoutAmount,
            razorpayPayoutId: payout.razorpayPayoutId,
            status: 'PROCESSING',
            processedAt: new Date(),
          },
        });
      });
      
      this.logger.log(`Processed payout for driver ${driver.id}: ₹${payoutAmount}`);
      
      // Send FCM notification (fire-and-forget, outside transaction)
      this.firebaseService.notifyAllSessions(driver.id, 'driver', {
        notification: {
          title: 'Payout Processed! 💰',
          body: `₹${payoutAmount.toFixed(2)} has been sent to your account`,
        },
        data: {
          event: FcmEventType.PayoutProcessed,
          amount: payoutAmount.toString(),
          payoutId: payout.razorpayPayoutId,
        },
      });
    }
    
    this.logger.log('Daily payout processing completed');
  }
}
