import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { CreatePayoutParams, PayoutResponse, FetchPayoutResponse, RazorpayPayoutResponse, RazorpayFundAccountResponse } from './types/razorpayx-payout.types';

/**
 * RazorpayX Service - Handles payout operations using RazorpayX API
 * RazorpayX is Razorpay's banking and payout platform
 */
@Injectable()
export class RazorpayXService {
  private readonly logger = new Logger(RazorpayXService.name);
  private readonly baseUrl = 'https://api.razorpay.com/v1';
  private readonly axiosInstance: AxiosInstance;
  private readonly accountNumber: string;

  constructor(private readonly configService: ConfigService) {
    const keyId = this.configService.get<string>('RAZORPAY_KEY_ID');
    const keySecret = this.configService.get<string>('RAZORPAY_KEY_SECRET');
    const accountNumber = this.configService.get<string>('RAZORPAY_ACCOUNT_NUMBER') || '2323230041626905';
    if (!keyId || !keySecret) {
      throw new Error('RazorpayX credentials not configured');
    }

    this.accountNumber = accountNumber;

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000, // 10 seconds timeout to prevent hanging
    });

    this.logger.log('RazorpayX service initialized');
  }

  /**
   * Creates a Razorpay payout to transfer funds to a driver's fund account.
   * @param params Payout parameters including fundAccountId, amount, currency, and mode
   * @returns Promise<PayoutResponse> - the payout details including razorpayPayoutId
   */
  async createPayout(params: CreatePayoutParams): Promise<PayoutResponse> {
    try {
      // Validate amount is positive and >= minimum (0.01 INR = 1 paise)
      if (params.amount <= 0) {
        throw new BadRequestException('Payout amount must be greater than zero');
      }

      // Razorpay requires amount in paisa (smallest currency unit)
      const amountInPaise = Math.round(params.amount * 100);
      
      if (amountInPaise < 1) {
        throw new BadRequestException('Amount must be >= ₹0.01 (1 paise)');
      }

      // Normalize and validate currency
      const currency = (params.currency || 'INR').toUpperCase();
      
      // Normalize and validate mode
      const allowedModes = ['IMPS', 'NEFT', 'RTGS', 'UPI'] as const;
      const mode = (params.mode || 'IMPS').toUpperCase() as typeof allowedModes[number];
      
      if (!allowedModes.includes(mode)) {
        throw new BadRequestException(`Invalid mode. Allowed: ${allowedModes.join(', ')}`);
      }

      const purpose = params.purpose || 'payout';

      // Fetch fund account details to validate mode compatibility
      const fundAccount = await this.getFundAccountDetails(params.fundAccountId);

      // CRITICAL: Validate payout mode based on fund account type
      // RazorpayX enforces strict rules:
      // - VPA (UPI) accounts MUST use mode="UPI"
      // - Bank accounts CANNOT use mode="UPI"
      if (fundAccount.account_type === 'vpa' && mode !== 'UPI') {
        throw new BadRequestException(
          `UPI fund accounts must use mode="UPI". Current mode: ${mode}`,
        );
      }

      if (fundAccount.account_type === 'bank_account' && mode === 'UPI') {
        throw new BadRequestException(
          'Bank account fund accounts cannot use mode="UPI". Use IMPS, NEFT, or RTGS instead.',
        );
      }

      const payoutData = {
        account_number: this.accountNumber,
        fund_account_id: params.fundAccountId,
        amount: amountInPaise,
        currency,
        mode,
        purpose,
        queue_if_low_balance: true,
        reference_id: params.referenceId,
      };

      this.logger.log(
        `Creating RazorpayX payout: fund_account=${params.fundAccountId}, amount=₹${params.amount} ${currency}, mode=${mode}`,
      );

      // Add idempotency key to prevent duplicate payouts on retry
      const headers: Record<string, string> = {};
      if (params.referenceId) {
        headers['Idempotency-Key'] = params.referenceId;
      }

      const response = await this.axiosInstance.post<RazorpayPayoutResponse>(
        '/payouts',
        payoutData,
        { headers },
      );

      const razorpayPayoutId = response.data.id;
      const status = response.data.status as PayoutResponse['status'];
      const amount = response.data.amount / 100; // Convert back to rupees

      this.logger.log(`Created RazorpayX payout with ID: ${razorpayPayoutId}, status: ${status}`);

      return { razorpayPayoutId, status, amount };
    } catch (error) {
      // Re-throw BadRequestException as-is
      if (error instanceof BadRequestException) {
        throw error;
      }

      // Handle Razorpay errors with axios error checking
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const errorData = error.response?.data;

        if (status === 400) {
          const errorMessage = errorData?.error?.description || 'Invalid payout request';
          this.logger.error(`RazorpayX validation error: ${JSON.stringify(errorData)}`);
          throw new BadRequestException(errorMessage);
        }

        this.logger.error(`RazorpayX API Error: ${status} - ${JSON.stringify(errorData)}`);
      } else {
        this.logger.error(`RazorpayX payout creation failed: ${error.message}`);
      }

      throw new InternalServerErrorException('Failed to create payout');
    }
  }

  /**
   * Fetches fund account details to determine account type (VPA or bank_account).
   * This is useful for validating payout mode compatibility.
   * @param fundAccountId The Razorpay fund account ID
   * @returns Promise with fund account details including account_type
   */
  async getFundAccountDetails(fundAccountId: string): Promise<{
    id: string;
    account_type: 'vpa' | 'bank_account';
  }> {
    try {
      this.logger.log(`Fetching fund account details for ID: ${fundAccountId}`);

      const response = await this.axiosInstance.get<RazorpayFundAccountResponse>(
        `/fund_accounts/${fundAccountId}`,
      );

      const account_type = response.data.account_type;

      // Validate account_type is one of the expected values
      if (!['vpa', 'bank_account'].includes(account_type)) {
        this.logger.error(`Unexpected account_type from Razorpay: ${account_type}`);
        throw new InternalServerErrorException('Unsupported fund account type from Razorpay');
      }

      return {
        id: response.data.id,
        account_type,
      };
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }

      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const errorData = error.response?.data;
        this.logger.error(`Failed to fetch fund account details: ${status} - ${JSON.stringify(errorData)}`);
      } else {
        this.logger.error(`Failed to fetch fund account details: ${error.message}`);
      }

      throw new InternalServerErrorException('Failed to fetch fund account details');
    }
  }

  /**
   * Fetches the status of a Razorpay payout.
   * @param payoutId The Razorpay payout ID
   * @returns Promise<FetchPayoutResponse> - the payout status and details
   */
  async fetchPayout(payoutId: string): Promise<FetchPayoutResponse> {
    try {
      this.logger.log(`Fetching RazorpayX payout status for ID: ${payoutId}`);

      const response: AxiosResponse = await this.axiosInstance.get(`/payouts/${payoutId}`);

      const payoutData = response.data;

      this.logger.log(`Fetched payout ${payoutId} with status: ${payoutData.status}`);

      return {
        id: payoutData.id,
        status: payoutData.status,
        amount: payoutData.amount / 100, // Convert from paisa to rupees
        currency: payoutData.currency,
        mode: payoutData.mode,
        failureReason: payoutData.failure_reason || undefined,
      };
    } catch (error) {
      const message = error.response?.data || error.message;
      this.logger.error(`RazorpayX payout fetch failed: ${JSON.stringify(message)}`);
      throw new InternalServerErrorException('Failed to fetch payout status');
    }
  }
}
