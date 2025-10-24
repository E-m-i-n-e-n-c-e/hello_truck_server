import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import Razorpay = require('razorpay');
import { CreatePayoutDetailsDto, PayoutMethod } from './dtos/payout-details.dto';
import { Orders } from 'razorpay/dist/types/orders';
import { PaymentLinks } from 'razorpay/dist/types/paymentLink';

@Injectable()
export class RazorpayService {
  private readonly logger = new Logger(RazorpayService.name);
  private readonly baseUrl = 'https://api.razorpay.com/v1';
  private readonly axiosInstance: AxiosInstance;
  private readonly razorpayInstance: Razorpay;

  constructor(
    private readonly configService: ConfigService,
  ) {
    const keyId = this.configService.get<string>('RAZORPAY_KEY_ID');
    const keySecret = this.configService.get<string>('RAZORPAY_KEY_SECRET');

    if (!keyId || !keySecret) {
      throw new Error('Razorpay credentials not configured');
    }

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });

    this.razorpayInstance = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
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

      const fundAccountData: any = {
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

  async validateBankDetails(ifscCode: string, accountNumber: string): Promise<boolean> {
    try {
      this.logger.log(`Validating bank details for IFSC: ${ifscCode}`);

      const response: AxiosResponse = await this.axiosInstance.get('/bank_accounts/validate', {
        params: {
          ifsc: ifscCode,
          account_number: accountNumber,
        },
      });

      const isValid = response.data.valid === true || response.data.success === true;
      this.logger.log(`Bank details validation result: ${isValid}`);

      return isValid;
    } catch (error) {
      this.logger.error(`Failed to validate bank details: ${error.message}`);
      return false;
    }
  }

  async validateVpa(vpa: string): Promise<boolean> {
    try {
      this.logger.log(`Validating VPA: ${vpa}`);

      const response: AxiosResponse = await this.axiosInstance.get('/vpa/validate', {
        params: {
          vpa: vpa,
        },
      });

      const isValid = response.data.valid === true || response.data.success === true;
      this.logger.log(`VPA validation result: ${isValid}`);

      return isValid;
    } catch (error) {
      this.logger.error(`Failed to validate VPA: ${error.message}`);
      return false;
    }
  }

  async createOrder(
    orderData: Orders.RazorpayOrderCreateRequestBody
  ): Promise<string> {
    try {
      this.logger.log(`Creating Razorpay order for amount: ${orderData.amount}`);

      const order = await this.razorpayInstance.orders.create(orderData);

      const orderId = order.id;
      this.logger.log(`Created Razorpay order with ID: ${orderId}`);

      return orderId;
    } catch (error) {
      if (error.response) {
        this.logger.error(`Razorpay API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      }
      this.logger.error(`Failed to create Razorpay order: ${error.message}`);
      throw new Error(`Failed to create Razorpay order: ${error.message}`);
    }
  }

  /**
   * Creates a Razorpay payment link from an order.
   * @param orderId The ID of the order/booking to create a payment link for.
   * @param amount The amount (in rupees - will be multiplied by 100 for paise).
   * @param currency The currency code (e.g. "INR").
   * @param description Description for the payment.
   * @param customerInfo Object containing customer fields as per Razorpay docs
   *        (expects: { name, contact, email })
   * @returns Promise<string> - the short URL for the payment link
   */
  async createPaymentLinkFromOrder(
    orderId: string,
  ): Promise<string> {
    try {
      const order = await this.razorpayInstance.orders.fetch(orderId);
      this.logger.log(`Creating Razorpay payment link for order: ${JSON.stringify(order, null, 2)}`);

      const customerEmail = order.notes?.['customer_email'] as string || '';
      const customerContact = order.notes?.['customer_contact'] as string || '';
      const customerName = order.notes?.['customer_name'] as string || '';
      const description = order.notes?.['description'] as string || '';

      // Razorpay requires amount in paisa, integer.
      const paymentLinkData: PaymentLinks.RazorpayPaymentLinkCreateRequestBody = {
        amount: order.amount,
        currency: order.currency,
        description: description,
        // reference_id: order.id,
        customer: {
          name: customerName,
          contact: customerContact.startsWith('+91') ? customerContact : `+91${customerContact}`,
          email: customerEmail,
        },
        notify: {
          email: !!customerEmail,
          sms: !!customerContact,
        },
        accept_partial: false,
        // upi_link: true,
      };

      const response: AxiosResponse = await this.axiosInstance.post('/payment_links', paymentLinkData);

      const paymentLinkId = response.data.id;
      const paymentLinkUrl = response.data.short_url;

      this.logger.log(`Created Razorpay payment link for order ${order.id} with ID: ${paymentLinkId}, URL: ${paymentLinkUrl}`);

      return paymentLinkUrl;
    } catch (error) {
      if (error.response) {
        this.logger.error(`Razorpay API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      }
      this.logger.error(`Failed to create Razorpay payment link for order: ${error.message}`);
      throw new Error(`Failed to create Razorpay payment link for order: ${error.message}`);
    }
  }
}