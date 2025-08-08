import { Controller, Post, Body } from '@nestjs/common';
import { RazorpayService } from './razorpay.service';
import { CreatePayoutDetailsDto } from './dtos/payout-details.dto';

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
}
