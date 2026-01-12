import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { createHmac } from 'crypto';
import { CreatePayoutDetailsDto, PayoutMethod } from './dtos/payout-details.dto';
import { PaymentLinks } from 'razorpay/dist/types/paymentLink';
import { RazorpayFundAccountData, RazorpayRefundData, CreateRefundParams, RefundResponse, RazorpayRefundResponse } from './types/razorpay-fund-account.types';
import { CreatePaymentLinkParams, PaymentLinkResponse } from './types/razorpay-payment-link.types';

@Injectable()
export class RazorpayService {
  private readonly logger = new Logger(RazorpayService.name);
  private readonly baseUrl = 'https://api.razorpay.com/v1';
  private readonly axiosInstance: AxiosInstance;
  private readonly webhookSecret: string;

  constructor(private readonly configService: ConfigService) {
    const keyId = this.configService.get<string>('RAZORPAY_KEY_ID');
    const keySecret = this.configService.get<string>('RAZORPAY_KEY_SECRET');
    this.webhookSecret = this.configService.get<string>('RAZORPAY_WEBHOOK_SECRET')!;

    if (!keyId || !keySecret) {
      throw new Error('Razorpay credentials not configured');
    }

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async createContact(phoneNumber: string, name?: string): Promise<string> {
    try {
      this.logger.log(`Creating Razorpay contact for phone: ${phoneNumber}`);

      const contactData = {
        name: name || phoneNumber,
        contact: phoneNumber,
        type: 'employee', // Default type for drivers
      };

      const response: AxiosResponse = await this.axiosInstance.post('/contacts', contactData);

      const contactId = response.data.id;
      this.logger.log(`Created Razorpay contact with ID: ${contactId}`);

      return contactId;
    } catch (error) {
      this.logger.error(`Failed to create Razorpay contact: ${error.message}`);
      throw new Error(`Failed to create Razorpay contact: ${error.message}`);
    }
  }

  async createFundAccount(
    contactId: string,
    payoutDetails: CreatePayoutDetailsDto,
  ): Promise<string> {
    try {
      this.logger.log(`Creating Razorpay fund account for contact: ${contactId}`);

      const fundAccountData : any = {
        contact_id: contactId,
      };

      if (payoutDetails.payoutMethod === PayoutMethod.BANK_ACCOUNT) {
        const bankDetails = payoutDetails.bankDetails;
        if (!bankDetails) {
          throw new Error('Bank details required for BANK_ACCOUNT method');
        }

        fundAccountData.account_type = 'bank_account';
        fundAccountData.bank_account = {
          name: bankDetails.accountHolderName,
          ifsc: bankDetails.ifscCode,
          account_number: bankDetails.accountNumber,
        };
      } else if (payoutDetails.payoutMethod === PayoutMethod.VPA) {
        const vpaDetails = payoutDetails.vpaDetails;
        if (!vpaDetails) {
          throw new Error('VPA details required for VPA method');
        }

        fundAccountData.account_type = 'vpa';
        fundAccountData.vpa = {
          address: vpaDetails.vpa,
        };

        // Log the exact payload being sent
        this.logger.log(`VPA Fund Account Payload: ${JSON.stringify(fundAccountData, null, 2)}`);
      } else {
        throw new Error(`Unsupported payout method: ${payoutDetails.payoutMethod}`);
      }

      const response: AxiosResponse = await this.axiosInstance.post('/fund_accounts', fundAccountData);

      const fundAccountId = response.data.id;
      this.logger.log(`Created Razorpay fund account with ID: ${fundAccountId}`);

      return fundAccountId;
    } catch (error) {
      // Enhanced error logging
      if (error.response) {
        this.logger.error(`Razorpay API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      }
      this.logger.error(`Failed to create Razorpay fund account: ${error.message}`);
      throw new Error(`Failed to create Razorpay fund account: ${error.message}`);
    }
  }

  /**
   * Creates a Razorpay payment link.
   * @param params Payment link parameters
   * @returns Promise<PaymentLinkResponse> - the payment link details
   */
  async createPaymentLink(params: CreatePaymentLinkParams): Promise<PaymentLinkResponse> {
    try {
      const currency = params.currency || 'INR';
      this.logger.log(`Creating Razorpay payment link for amount: ${params.amount} ${currency}`);

      // Razorpay requires amount in paisa (smallest currency unit)
      const amountInPaise = Math.round(params.amount * 100);

      const paymentLinkData: PaymentLinks.RazorpayPaymentLinkCreateRequestBody = {
        amount: amountInPaise,
        currency: currency,
        description: params.description,
        reference_id: params.referenceId,
        customer: {
          name: params.customerName,
          contact: params.customerContact.startsWith('+91')
            ? params.customerContact
            : `+91${params.customerContact}`,
          email: params.customerEmail || undefined,
        },
        notify: {
          email: params.disableNotifications ? false : !!params.customerEmail,
          sms: params.disableNotifications ? false : !!params.customerContact,
        },
        accept_partial: params.acceptPartial ?? false,
        first_min_partial_amount: params.firstMinPartialAmount
          ? Math.round(params.firstMinPartialAmount * 100)
          : undefined,
        expire_by: params.expireBy,
        notes: {
          paymentType: params.paymentType,
        },
      };

      const response: AxiosResponse = await this.axiosInstance.post('/payment_links', paymentLinkData);

      const paymentLinkId = response.data.id;
      const paymentLinkUrl = response.data.short_url;

      this.logger.log(`Created Razorpay payment link with ID: ${paymentLinkId}, URL: ${paymentLinkUrl}`);

      return { paymentLinkUrl, paymentLinkId };
    } catch (error) {
      if (error.response) {
        this.logger.error(`Razorpay API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      }
      this.logger.error(`Failed to create Razorpay payment link: ${error.message}`);
      throw new Error(`Failed to create Razorpay payment link: ${error.message}`);
    }
  }

  /**
   * Cancels a Razorpay payment link to prevent further payments.
   * @param paymentLinkId The Razorpay payment link ID to cancel
   * @returns Promise<void>
   */
  async cancelPaymentLink(paymentLinkId: string): Promise<void> {
    try {
      this.logger.log(`Cancelling Razorpay payment link: ${paymentLinkId}`);

      await this.axiosInstance.post(`/payment_links/${paymentLinkId}/cancel`);

      this.logger.log(`Successfully cancelled payment link: ${paymentLinkId}`);
    } catch (error) {
      if (error.response) {
        this.logger.error(`Razorpay API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      }
      this.logger.error(`Failed to cancel payment link: ${error.message}`);
      // Don't throw - cancellation failure shouldn't break the main flow
    }
  }

  /**
   * Verifies the signature of a Razorpay webhook to ensure authenticity.
   * Uses HMAC SHA256 to validate the webhook signature against the payload.
   * @param payload The raw webhook payload as a string
   * @param signature The signature from the x-razorpay-signature header
   * @returns boolean - true if signature is valid, false otherwise
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    try {
      this.logger.log('Verifying Razorpay webhook signature');

      // Use the configured webhook secret
      const secret = this.webhookSecret;
      if (!secret) {
        this.logger.warn('Webhook secret not configured, signature verification will fail');
        return false;
      }

      // Generate expected signature using HMAC SHA256
      const expectedSignature = createHmac('sha256', secret).update(payload).digest('hex');

      // Compare signatures using timing-safe comparison
      const isValid = expectedSignature === signature;

      this.logger.log(`Webhook signature verification result: ${isValid}`);

      return isValid;
    } catch (error) {
      this.logger.error(`Failed to verify webhook signature: ${error.message}`);
      return false;
    }
  }

  /**
   * Creates a refund for a payment.
   * @param params Refund parameters including paymentId and optional amount
   * @returns Promise<RefundResponse> - the refund details
   */
  async createRefund(params: CreateRefundParams): Promise<RefundResponse> {
    try {
      this.logger.log(`Creating Razorpay refund for payment: ${params.paymentId}`);

      const refundData: RazorpayRefundData = {
        payment_id: params.paymentId,
      };

      // Partial refund
      if (params.amount !== undefined) {
        const amountInPaise = Math.round(params.amount * 100);
        refundData.amount = amountInPaise;

        this.logger.log(`Partial refund amount: ₹${params.amount} (${amountInPaise} paise)`);
      } else {
        this.logger.log('Full refund requested');
      }

      // Optional metadata
      if (params.notes) {
        refundData.notes = params.notes;
      }

      if (params.referenceId) {
        refundData.receipt = params.referenceId; // Razorpay's field name
      }

      // Hit Razorpay API with strong typing
      const response = await this.axiosInstance.post<RazorpayRefundResponse>(
        `/payments/${params.paymentId}/refund`,
        refundData,
      );

      const refund = response.data;

      this.logger.log(
        `Refund created: ID=${refund.id}, amount=₹${refund.amount / 100} ${refund.currency}, status=${refund.status}`,
      );

      return {
        refundId: refund.id,
        paymentId: refund.payment_id, // Use Razorpay's value, not request param
        amount: refund.amount / 100, // Convert from paise to rupees
        currency: refund.currency,
        status: refund.status,
        createdAt: refund.created_at,
        notes: refund.notes,
      };
    } catch (error) {
      if (error.response) {
        this.logger.error(
          `Razorpay API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`,
        );
      }

      this.logger.error(`Failed to create Razorpay refund: ${error.message}`);
      throw new Error(`Failed to create Razorpay refund: ${error.message}`);
    }
  }

  /**
   * Fetches all refunds for a specific payment.
   * Useful for idempotency checks.
   * @param paymentId The Razorpay payment ID
   * @returns List of refunds
   */
  async fetchRefunds(paymentId: string): Promise<RefundResponse[]> {
    try {
      this.logger.log(`Fetching refunds for payment: ${paymentId}`);

      const response = await this.axiosInstance.get<{ items: RazorpayRefundResponse[] }>(
        `/payments/${paymentId}/refunds`,
      );

      return response.data.items.map(refund => ({
        refundId: refund.id,
        paymentId: refund.payment_id,
        amount: refund.amount / 100, // Convert to rupees
        currency: refund.currency,
        status: refund.status,
        createdAt: refund.created_at,
        notes: refund.notes,
      }));
    } catch (error) {
      this.logger.error(`Failed to fetch refunds: ${error.message}`);
      throw new Error(`Failed to fetch refunds: ${error.message}`);
    }
  }
}