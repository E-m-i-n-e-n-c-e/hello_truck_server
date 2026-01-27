/**
 * Razorpay Fund Account Types
 */

export interface RazorpayFundAccountData {
  contact_id: string;
  account_type: 'bank_account' | 'vpa';
  bank_account?: {
    name: string;
    ifsc: string;
    account_number: string;
  };
  vpa?: {
    address: string;
  };
}

export interface RazorpayRefundData {
  payment_id: string;
  amount?: number; // Optional - if not specified, full refund
  notes?: {
    [key: string]: string | undefined;
  };
  receipt?: string;
}

export interface CreateRefundParams {
  paymentId: string;
  amount?: number; // Optional - if not provided, full refund
  notes?: {
    bookingId?: string;
    reason?: string;
    [key: string]: string | undefined;
  };
  receipt?: string;
  referenceId?: string;
}

export interface RefundResponse {
  refundId: string;
  paymentId: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: number;
  notes?: Record<string, string | undefined>;
}

/**
 * Razorpay API Refund Response
 * Direct response from Razorpay API
 */
export interface RazorpayRefundResponse {
  id: string;
  payment_id: string;
  amount: number;
  currency: string;
  status: string;
  created_at: number;
  notes?: Record<string, string | undefined>;
}
