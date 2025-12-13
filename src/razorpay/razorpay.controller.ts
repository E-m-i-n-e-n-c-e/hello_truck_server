import { Controller, Post, Body } from '@nestjs/common';
import { RazorpayService } from './razorpay.service';
import { CreatePayoutDetailsDto } from './dtos/payout-details.dto';
import { Orders } from 'razorpay/dist/types/orders';

@Controller('razorpay')
export class RazorpayController {
  constructor(private readonly razorpayService: RazorpayService) {}

  @Post('create-contact')
  async createContact(@Body() body: { phoneNumber: string, name?: string }) {
    return this.razorpayService.createContact(body.phoneNumber, body.name);
  }

  @Post('create-fund-account')
  async createFundAccount(@Body() body: { contactId: string, payoutDetails: CreatePayoutDetailsDto }) {
    return this.razorpayService.createFundAccount(body.contactId, body.payoutDetails);
  }

  @Post('refund')
  async createRefund(@Body() body: { paymentId: string, amount?: number, notes?: any }) {
    return this.razorpayService.createRefund({
      paymentId: body.paymentId,
      amount: body.amount,
      notes: body.notes,
    });
  }

  @Post('fetch-refunds')
  async fetchRefunds(@Body() body: { paymentId: string }) {
    return this.razorpayService.fetchRefunds(body.paymentId);
  }
}
