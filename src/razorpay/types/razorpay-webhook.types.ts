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
    order: {
      entity: RazorpayOrderEntity;
    };
    payment: {
      entity: RazorpayPaymentEntity;
    };
    payment_link: {
      entity: RazorpayPaymentLinkEntity;
    };
  };
  created_at: number;
}

export interface RazorpayOrderEntity {
  id: string;
  entity: 'order';
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string | null;
  offer_id: string | null;
  status: 'created' | 'attempted' | 'paid';
  attempts: number;
  notes: Record<string, any> | any[];
  created_at: number;
}

export interface RazorpayPaymentEntity {
  id: string;
  entity: 'payment';
  amount: number;
  currency: string;
  status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed';
  order_id: string;
  invoice_id: string | null;
  international: boolean;
  method: string;
  amount_refunded: number;
  refund_status: string | null;
  captured: boolean;
  description: string;
  card_id: string | null;
  card: any | null;
  bank: string | null;
  wallet: string | null;
  vpa: string | null;
  email: string;
  contact: string;
  customer_id?: string;
  notes: Record<string, any> | any[];
  fee: number;
  tax: number;
  error_code: string | null;
  error_description: string | null;
  error_source: string | null;
  error_step: string | null;
  error_reason: string | null;
  acquirer_data: Record<string, any>;
  created_at: number;
}

export interface RazorpayPaymentLinkEntity {
  id: string;
  short_url: string;
  reference_id: string;
  status: 'created' | 'partially_paid' | 'paid' | 'expired' | 'cancelled';
  description: string;
  amount: number;
  amount_paid: number;
  currency: string;
  created_at: number;
  updated_at: number;
  user_id: string;
  customer: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notify: {
    sms: boolean;
    email: boolean;
    whatsapp: boolean;
  };
  reminder_enable: boolean;
  reminders: {
    status: string;
  };
  order_id: string;
  cancelled_at: number;
  expired_at: number;
  expire_by: number;
  accept_partial: boolean;
  first_min_partial_amount: number;
  upi_link: boolean;
  whatsapp_link: boolean;
  notes: Record<string, any> | null;
}
