/**
 * RazorpayX Payout Types
 */

export interface CreatePayoutParams {
  fundAccountId: string;
  amount: number;
  currency?: string;
  mode?: 'IMPS' | 'NEFT' | 'RTGS' | 'UPI';
  purpose?: string;
  referenceId: string;
}

export interface PayoutResponse {
  razorpayPayoutId: string;
  status: 'processing' | 'processed' | 'reversed' | 'cancelled' | 'queued' | 'rejected';
  amount: number;
}

export interface FetchPayoutResponse {
  id: string;
  status: 'processing' | 'processed' | 'reversed' | 'cancelled' | 'queued' | 'rejected';
  amount: number;
  currency: string;
  mode: string;
  failureReason?: string;
}

/**
 * Razorpay API response types
 */
export interface RazorpayPayoutResponse {
  id: string;
  status: string;
  amount: number;
  currency: string;
  mode: string;
  purpose: string;
  reference_id?: string;
  fund_account_id: string;
  created_at: number;
}

export interface RazorpayFundAccountResponse {
  id: string;
  account_type: 'vpa' | 'bank_account';
  contact_id: string;
  active: boolean;
}
