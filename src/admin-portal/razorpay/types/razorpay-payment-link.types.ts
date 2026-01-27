/**
 * Razorpay Payment Link Types
 */

export enum PaymentType {
  DRIVER_WALLET = 'DRIVER_WALLET',
  BOOKING_INVOICE = 'BOOKING_INVOICE',
}

export interface CreatePaymentLinkParams {
  amount: number;
  currency?: string;
  description: string;
  customerName: string;
  customerContact: string;
  customerEmail?: string;
  referenceId?: string;
  /** Allow partial payments */
  acceptPartial?: boolean;
  /** Minimum first partial amount in rupees */
  firstMinPartialAmount?: number;
  /** Unix timestamp for link expiry */
  expireBy?: number;
  /** Disable email and SMS notifications */
  disableNotifications?: boolean;
  /** Mandatory payment type for webhook routing */
  paymentType: PaymentType;
}

export interface PaymentLinkResponse {
  paymentLinkUrl: string;
  paymentLinkId: string;
}
