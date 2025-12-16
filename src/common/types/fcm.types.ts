// Typed FCM event kinds used by clients to route behaviors
export enum FcmEventType {
  DriverAssignmentOffered = 'DRIVER_ASSIGNMENT_OFFERED',
  BookingStatusChange = 'BOOKING_STATUS_CHANGE',
  PaymentSuccess = 'PAYMENT_SUCCESS',
  RideCancelled = 'RIDE_CANCELLED',
  WalletChange = 'WALLET_CHANGE',
  TransactionChange = 'TRANSACTION_CHANGE',
  PayoutProcessed = 'PAYOUT_PROCESSED',
  DriverVerificationUpdated = 'DRIVER_VERIFICATION_UPDATE',
  RefundProcessed = 'REFUND_PROCESSED',
}

// App-level typed payload for FCM
export interface AppMessagingPayload {
  notification?: {
    title: string;
    body: string;
  };
  data?: {
    event: FcmEventType;
    [key: string]: string;
  };
}
