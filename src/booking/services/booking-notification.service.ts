import { Injectable } from '@nestjs/common';
import { FirebaseService } from 'src/firebase/firebase.service';
import { FcmEventType } from 'src/common/types/fcm.types';
import { UserType } from 'src/common/types/user-session.types';
import { BookingStatus } from '@prisma/client';

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

  // Changes booking status to CONFIRMED
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
        newStatus: BookingStatus.CONFIRMED,
      },
    });
  }

  // Changes booking status to PICKUP_ARRIVED
  notifyCustomerPickupArrived(customerId: string): void {
    this.firebaseService.notifyAllSessions(customerId, 'customer', {
      notification: {
        title: 'Pickup Arrived',
        body: 'Your driver has arrived at the pickup location. Please verify the pickup and proceed with the delivery.',
      },
      data: {
        event: FcmEventType.BookingStatusChange,
        newStatus: BookingStatus.PICKUP_ARRIVED,
      },
    });
  }

  // Changes booking status to PICKUP_VERIFIED
  notifyCustomerPickupVerified(customerId: string): void {
    this.firebaseService.notifyAllSessions(customerId, 'customer', {
      notification: {
        title: 'Parcel Pickup Verified',
        body: 'Your parcel has been picked up and is on its way to the drop location.',
      },
      data: {
        event: FcmEventType.BookingStatusChange,
        newStatus: BookingStatus.PICKUP_VERIFIED,
      },
    });
  }

  // Changes booking status to DROP_ARRIVED
  notifyCustomerDropArrived(customerId: string): void {
    this.firebaseService.notifyAllSessions(customerId, 'customer', {
      notification: {
        title: 'Parcel Drop Arrived',
        body: 'Your parcel has arrived at the drop location. Please verify the drop and proceed with the delivery.',
      },
      data: {
        event: FcmEventType.BookingStatusChange,
        newStatus: BookingStatus.DROP_ARRIVED,
      },
    });
  }

  // Changes booking status to DROP_VERIFIED
  notifyCustomerDropVerified(customerId: string): void {
    this.firebaseService.notifyAllSessions(customerId, 'customer', {
      notification: {
        title: 'Parcel Drop Verified',
        body: 'Your parcel has been dropped off at the destination.',
      },
      data: {
        event: FcmEventType.BookingStatusChange,
        newStatus: BookingStatus.DROP_VERIFIED,
      },
    });
  }

  // Changes booking status to COMPLETED
  notifyCustomerRideCompleted(customerId: string): void {
    this.firebaseService.notifyAllSessions(customerId, 'customer', {
      notification: {
        title: 'Ride Completed',
        body: 'Your driver has completed the ride. Thank you for using Hello Truck.',
      },
      data: {
        event: FcmEventType.BookingStatusChange,
        newStatus: BookingStatus.COMPLETED,
      },
    });
  }

  // Changes booking status to IN_TRANSIT
  notifyCustomerRideStarted(customerId: string): void {
    this.firebaseService.notifyAllSessions(customerId, 'customer', {
      notification: {
        title: 'Ride Started',
        body: 'Driver has started the ride. Please sit back and relax as your parcel is being delivered.',
      },
      data: {
        event: FcmEventType.BookingStatusChange,
        newStatus: BookingStatus.IN_TRANSIT,
      },
    });
  }

  // Changes wallet logs and customer wallet balance
  notifyCustomerWalletApplied(customerId: string, amount: number): void {
    this.firebaseService.notifyAllSessions(customerId, 'customer', {
      notification: {
        title: 'Wallet Applied',
        body: `₹${amount.toFixed(2)} wallet balance applied to your booking`,
      },
      data: {
        event: FcmEventType.WalletChange,
        amount: amount.toString(),
      },
    });
  }

  // Changes wallet logs and customer wallet balance
  notifyCustomerWalletDebtCleared(customerId: string, amount: number): void {
    this.firebaseService.notifyAllSessions(customerId, 'customer', {
      notification: {
        title: 'Wallet Debt Cleared',
        body: `₹${Math.abs(amount).toFixed(2)} debt added to booking payment`,
      },
      data: {
        event: FcmEventType.WalletChange, // Debt cleared = wallet credit
        amount: Math.abs(amount).toString(),
      },
    });
  }

  // Changes booking status to COMPLETED
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
      },
    });
  }

  // Changes booking status to CANCELLED. Creates refund intent
  notifyCustomerBookingCancelled(customerId: string): void {
    this.firebaseService.notifyAllSessions(customerId, 'customer', {
      notification: {
        title: 'Booking Cancelled',
        body: 'Your booking has been successfully cancelled. Any applicable refund will be processed and credited to your original payment method within 24 hours.',
      },
      data: {
        event: FcmEventType.BookingStatusChange,
        newStatus: BookingStatus.CANCELLED,
      },
    });
  }

  // Changes booking status to EXPIRED
  notifyCustomerBookingExpired(customerId: string): void {
    this.firebaseService.notifyAllSessions(customerId, 'customer', {
      notification: {
        title: 'Booking Expired',
        body: 'Sorry, we could not find a driver for your booking. Please try again.',
      },
      data: {
        event: FcmEventType.BookingStatusChange,
        newStatus: BookingStatus.EXPIRED,
      },
    });
  }

  // May update refund intent, transaction, and wallet balance/wallet logs
  notifyCustomerRefundProcessed(customerId: string, bookingNumber: bigint): void {
    this.firebaseService.notifyAllSessions(customerId, 'customer', {
      notification: {
        title: 'Refund Processed',
        body: `Refund processed for Booking #${bookingNumber}`,
      },
      data: {
        event: FcmEventType.RefundProcessed,
      },
    });
  }

  // Changes wallet logs and customer wallet balance
  notifyCustomerCancellationCharge(customerId: string, amount: number): void {
    this.firebaseService.notifyAllSessions(customerId, 'customer', {
      notification: {
        title: 'Cancellation Charge Applied',
        body: `₹${amount.toFixed(2)} cancellation charge deducted from your wallet`,
      },
      data: {
        event: FcmEventType.WalletChange,
      },
    });
  }

  // ============================================
  // Driver Notifications
  // ============================================

  // Changes wallet logs and driver wallet balance
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
        event: FcmEventType.WalletChange,
      },
    });
  }

  // Changes current assignment, driver status
  notifyDriverAssignmentOffered(driverId: string, bookingId: string): void {
    this.firebaseService.notifyAllSessions(driverId, 'driver', {
      notification: {
        title: 'New Ride Offer',
        body: 'You have been offered a ride',
      },
      data: { event: FcmEventType.DriverAssignmentOffered, bookingId },
    });
  }

  // Changes current assignment, driver status
  notifyDriverAssigmentTimeout(driverId: string, bookingId: string): void {
    this.firebaseService.notifyAllSessions(driverId, 'driver', {
      data: { event: FcmEventType.DriverAssignmentTimeout, bookingId },
    });
  }

  // Changes current assignment, driver status
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

  // Changes wallet logs and driver wallet balance
  notifyDriverCompensation(driverId: string, amount: number): void {
    this.firebaseService.notifyAllSessions(driverId, 'driver', {
      notification: {
        title: 'Compensation Received 💰',
        body: `₹${amount.toFixed(2)} cancellation compensation has been credited to your wallet`,
      },
      data: {
        event: FcmEventType.WalletChange,
        amount: amount.toString(),
      },
    });
  }

  // Changes booking status to COMPLETED
  notifyDriverPaymentReceived(
    driverId: string,
    bookingId: string,
    amount: number,
  ): void {
    this.firebaseService.notifyAllSessions(driverId, 'driver', {
      notification: {
        title: 'Payment Received! ✅',
        body: `₹${amount.toFixed(2)} payment received for Booking #${bookingId}`,
      },
      data: {
        event: FcmEventType.PaymentSuccess,
        bookingId,
        amount: amount.toString(),
      },
    });
  }

  // Changes driver wallet/logs, transaction, payouts
  notifyDriverPayoutProcessed(driverId: string, amount: number): void {
    this.firebaseService.notifyAllSessions(driverId, 'driver', {
      notification: {
        title: 'Payout Processed! 💰',
        body: `₹${amount.toFixed(2)} has been sent to your account`,
      },
      data: {
        event: FcmEventType.PayoutProcessed,
        amount: amount.toString(),
      },
    });
  }

  // Standalone events. Only use when none of the above apply and the assosciated entity changes

  // Changes booking status
  notifyBookingStatusChange(userId: string, userType: UserType, newStatus: BookingStatus): void {
    this.firebaseService.notifyAllSessions(userId, userType, {
      data: {
        event: FcmEventType.BookingStatusChange,
        newStatus: newStatus,
      },
    });
  }

  // Changes wallet/walletLogs
  notifyWalletChange(userId: string, userType: UserType): void {
    this.firebaseService.notifyAllSessions(userId, userType, {
      data: {
        event: FcmEventType.WalletChange,
      },
    });
  }
}


