import { Injectable } from '@nestjs/common';
import { FirebaseService } from 'src/firebase/firebase.service';
import { FcmEventType } from 'src/common/types/fcm.types';

/**
 * Service for handling all booking-related notifications
 * All notification methods are fire-and-forget (void return)
 */
@Injectable()
export class BookingNotificationService {
  constructor(private readonly firebaseService: FirebaseService) {}

  // ============================================
  // Customer Notifications
  // ============================================

  notifyCustomerBookingConfirmed(
    customerId: string,
    driverFirstName: string | null,
    driverLastName: string | null,
  ): void {
    const driverName = `${driverFirstName ?? ''} ${driverLastName ?? ''}`.trim();
    this.firebaseService.notifyAllSessions(customerId, 'customer', {
      notification: {
        title: 'Booking Confirmed',
        body: `Your booking has been confirmed. Your driver ${driverName} is on the way to pick up your parcel.`,
      },
      data: {
        event: FcmEventType.BookingStatusChange,
      },
    });
  }

  notifyCustomerBookingStatusChange(customerId: string): void {
    this.firebaseService.notifyAllSessions(customerId, 'customer', {
      data: {
        event: FcmEventType.BookingStatusChange,
      },
    });
  }

  notifyCustomerPickupArrived(customerId: string): void {
    this.firebaseService.notifyAllSessions(customerId, 'customer', {
      notification: {
        title: 'Parcel Pickup Arrived',
        body: 'Your driver has arrived at the pickup location. Please verify the pickup and proceed with the delivery.',
      },
      data: {
        event: FcmEventType.BookingStatusChange,
      },
    });
  }

  notifyCustomerPickupVerified(customerId: string): void {
    this.firebaseService.notifyAllSessions(customerId, 'customer', {
      notification: {
        title: 'Parcel Pickup Verified',
        body: 'Your parcel has been picked up and is on its way to the drop location.',
      },
      data: {
        event: FcmEventType.BookingStatusChange,
      },
    });
  }

  notifyCustomerDropArrived(customerId: string): void {
    this.firebaseService.notifyAllSessions(customerId, 'customer', {
      notification: {
        title: 'Parcel Drop Arrived',
        body: 'Your parcel has arrived at the drop location. Please verify the drop and proceed with the delivery.',
      },
      data: {
        event: FcmEventType.BookingStatusChange,
      },
    });
  }

  notifyCustomerDropVerified(customerId: string): void {
    this.firebaseService.notifyAllSessions(customerId, 'customer', {
      notification: {
        title: 'Parcel Drop Verified',
        body: 'Your parcel has been dropped off at the destination.',
      },
      data: {
        event: FcmEventType.BookingStatusChange,
      },
    });
  }

  notifyCustomerRideStarted(customerId: string): void {
    this.firebaseService.notifyAllSessions(customerId, 'customer', {
      notification: {
        title: 'Ride Started',
        body: 'Driver has started the ride. Please sit back and relax as your parcel is being delivered.',
      },
      data: {
        event: FcmEventType.BookingStatusChange,
      },
    });
  }

  notifyCustomerWalletApplied(customerId: string, amount: number): void {
    this.firebaseService.notifyAllSessions(customerId, 'customer', {
      notification: {
        title: 'Wallet Applied',
        body: `₹${amount.toFixed(2)} wallet balance applied to your booking`,
      },
      data: {
        event: FcmEventType.WalletDebit,
        amount: amount.toString(),
      },
    });
  }

  notifyCustomerWalletDebtCleared(customerId: string, amount: number): void {
    this.firebaseService.notifyAllSessions(customerId, 'customer', {
      notification: {
        title: 'Wallet Debt Cleared',
        body: `₹${Math.abs(amount).toFixed(2)} debt added to booking payment`,
      },
      data: {
        event: FcmEventType.WalletDebit,
        amount: Math.abs(amount).toString(),
      },
    });
  }

  notifyCustomerPaymentSuccess(
    customerId: string,
    amount: number,
    bookingNumber: number,
  ): void {
    this.firebaseService.notifyAllSessions(customerId, 'customer', {
      notification: {
        title: 'Payment Successful! ✅',
        body: `Your payment of ₹${amount.toFixed(2)} for Booking #${bookingNumber} was successful`,
      },
      data: {
        event: FcmEventType.PaymentSuccess,
        amount: amount.toString(),
      },
    });
  }

  notifyCustomerWalletCredited(customerId: string, amount: number): void {
    this.firebaseService.notifyAllSessions(customerId, 'customer', {
      notification: {
        title: 'Wallet Credited! 💰',
        body: `₹${amount.toFixed(2)} refund added to your wallet`,
      },
      data: {
        event: FcmEventType.WalletCredit,
        amount: amount.toString(),
      },
    });
  }

  notifyCustomerBookingCancelled(customerId: string): void {
    this.firebaseService.notifyAllSessions(customerId, 'customer', {
      notification: {
        title: 'Booking Cancelled',
        body: 'Your booking has been successfully cancelled. Any applicable refund will be processed and credited to your original payment method within 24 hours.',
      },
      data: {
        event: FcmEventType.BookingStatusChange,
      },
    });
  }

  // ============================================
  // Driver Notifications
  // ============================================

  notifyDriverWalletChange(
    driverId: string,
    amount: number,
    isCashPayment: boolean,
  ): void {
    this.firebaseService.notifyAllSessions(driverId, 'driver', {
      notification: {
        title: 'Ride Completed',
        body: isCashPayment
          ? `₹${Math.abs(amount).toFixed(2)} commission deducted from wallet for cash payment`
          : `₹${amount.toFixed(2)} earnings credited to your wallet`,
      },
      data: {
        event: isCashPayment ? FcmEventType.WalletDebit : FcmEventType.WalletCredit,
      },
    });
  }

  notifyDriverRideCancelled(driverId: string): void {
    this.firebaseService.notifyAllSessions(driverId, 'driver', {
      notification: {
        title: 'Booking Cancelled',
        body: 'Sorry, your ride has been cancelled by the customer. You will receive some compensation for your time.',
      },
      data: {
        event: FcmEventType.RideCancelled,
      },
    });
  }

  notifyDriverPaymentReceived(
    driverId: string,
    bookingId: string,
    amount: number,
  ): void {
    this.firebaseService.notifyAllSessions(driverId, 'driver', {
      data: {
        event: FcmEventType.PaymentSuccess,
        bookingId,
        amount: amount.toString(),
      },
    });
  }
}
