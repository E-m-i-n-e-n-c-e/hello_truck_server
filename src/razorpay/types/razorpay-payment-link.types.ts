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
  referenceId: string;
}

export interface PaymentLinkResponse {
  paymentLinkUrl: string;
  paymentLinkId: string;
}
