// Typed FCM event kinds used by clients to route behaviors
export enum FcmEventType {
  BookingStatusChange = 'BOOKING_STATUS_CHANGE',
  DriverAssignmentOffered = 'DRIVER_ASSIGNMENT_OFFERED',
  DriverAssignmentTimeout = 'DRIVER_ASSIGNMENT_TIMEOUT',
  DriverVerificationUpdate = 'DRIVER_VERIFICATION_UPDATE',
  PaymentSuccess = 'PAYMENT_SUCCESS',
  PayoutProcessed = 'PAYOUT_PROCESSED',
  RefundProcessed = 'REFUND_PROCESSED',
  RideCancelled = 'RIDE_CANCELLED',
  WalletChange = 'WALLET_CHANGE',
}

// App-level typed payload for FCM
export interface AppMessagingPayload {
  notification?: {
    title: string;
    body: string;
  };
  data?: {
    event: FcmEventType;
    [key: string]: any;
  };
}
