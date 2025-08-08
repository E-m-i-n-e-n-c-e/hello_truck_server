import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { CreatePayoutDetailsDto, PayoutMethod } from './dtos/payout-details.dto';

@Injectable()
export class RazorpayService {
  private readonly logger = new Logger(RazorpayService.name);
  private readonly baseUrl = 'https://api.razorpay.com/v1';
  private readonly axiosInstance: AxiosInstance;

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
}