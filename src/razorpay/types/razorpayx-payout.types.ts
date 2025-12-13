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
  narration?: string; // Appears in beneficiary's bank statement (max 30 chars)
  notes?: Record<string, string>; // Key-value metadata for tracking
}

export interface PayoutResponse {
  razorpayPayoutId: string;
  status: 'processing' | 'processed' | 'reversed' | 'cancelled' | 'queued' | 'rejected';
  amount: number;
}

export interface FetchPayoutResponse {
  id: string;
  status: 'processing' | 'processed' | 'reversed' | 'cancelled' | 'queued' | 'rejected' | 'pending' | 'failed';
  amount: number; // In rupees (converted from paise by service)
  currency: string;
  mode: string;
  purpose: string;
  referenceId?: string;
  utr?: string; // Bank transaction reference (useful for tracking)
  createdAt: number; // Unix timestamp
  failureReason?: string;
  statusDetails?: {
    description: string;
    source: string;
    reason: string;
  };
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
