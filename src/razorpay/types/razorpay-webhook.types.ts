/**
 * Razorpay Webhook Types
 * Based on Razorpay Payment Link webhook documentation
 */

export interface RazorpayWebhookPayload {
  entity: string;
  account_id: string;
  event: string;
  contains: string[];
  payload: {
    payment_link: {
      entity: RazorpayPaymentLinkEntity;
    };
  };
  created_at: number;
}

export interface RazorpayPaymentLinkEntity {
  id: string;
  short_url: string;
  reference_id: string;
  status: 'created' | 'partially_paid' | 'paid' | 'expired' | 'cancelled';
  description: string;
  amount: number;
  currency: string;
  created_at: number;
  updated_at: number;
  user_id: string;
  customer: {
    name?: string;
    email?: string;
    contact?: string;
  };
  payments?: RazorpayPayment[];
}

export interface RazorpayPayment {
  id: string;
  amount: number;
  currency: string;
  status: 'authorized' | 'captured' | 'refunded' | 'failed';
  method: string;
  created_at: number;
}
