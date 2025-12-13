import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { RazorpayService } from './razorpay.service';
import { RazorpayXService } from './razorpayx.service';
import { CreatePayoutDetailsDto } from './dtos/payout-details.dto';
import { CreatePaymentLinkParams } from './types/razorpay-payment-link.types';
import { CreatePayoutParams } from './types/razorpayx-payout.types';

@Controller('razorpay')
export class RazorpayController {
  constructor(
    private readonly razorpayService: RazorpayService,
    private readonly razorpayXService: RazorpayXService,
  ) {}

  // ============ Contact & Fund Account Management ============

  @Post('create-contact')
  async createContact(@Body() body: { phoneNumber: string; name?: string }) {
    const contactId = await this.razorpayService.createContact(body.phoneNumber, body.name);
    return { contactId };
  }

  @Post('create-fund-account')
  async createFundAccount(
    @Body() body: { contactId: string; payoutDetails: CreatePayoutDetailsDto },
  ) {
    const fundAccountId = await this.razorpayService.createFundAccount(
      body.contactId,
      body.payoutDetails,
    );
    return { fundAccountId };
  }

  @Get('fund-account/:fundAccountId')
  async getFundAccountDetails(@Param('fundAccountId') fundAccountId: string) {
    return this.razorpayXService.getFundAccountDetails(fundAccountId);
  }

  // ============ Payment Links ============

  @Post('create-payment-link')
  async createPaymentLink(@Body() body: CreatePaymentLinkParams) {
    return this.razorpayService.createPaymentLink(body);
  }

  // ============ Webhook Verification ============

  @Post('verify-webhook-signature')
  async verifyWebhookSignature(
    @Body() body: { payload: string; signature: string },
  ) {
    const isValid = this.razorpayService.verifyWebhookSignature(
      body.payload,
      body.signature,
    );
    return { isValid };
  }

  // ============ Refunds ============

  @Post('refund')
  async createRefund(
    @Body()
    body: {
      paymentId: string;
      amount?: number;
      notes?: any;
      referenceId?: string;
    },
  ) {
    return this.razorpayService.createRefund({
      paymentId: body.paymentId,
      amount: body.amount,
      notes: body.notes,
      referenceId: body.referenceId,
    });
  }

  @Post('fetch-refunds')
  async fetchRefunds(@Body() body: { paymentId: string }) {
    const refunds = await this.razorpayService.fetchRefunds(body.paymentId);
    return { refunds };
  }

  // ============ RazorpayX Payout Operations ============

  @Post('payout/create')
  async createPayout(@Body() body: CreatePayoutParams) {
    return this.razorpayXService.createPayout(body);
  }

  @Get('payout/:payoutId')
  async fetchPayout(@Param('payoutId') payoutId: string) {
    return this.razorpayXService.fetchPayout(payoutId);
  }
}
