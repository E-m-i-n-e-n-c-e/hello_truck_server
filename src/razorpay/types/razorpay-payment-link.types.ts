/**
 * Razorpay Payment Link Types
 */

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
}

export interface PaymentLinkResponse {
  paymentLinkUrl: string;
  paymentLinkId: string;
}
