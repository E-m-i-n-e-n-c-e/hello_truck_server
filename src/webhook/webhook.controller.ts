import {
  Controller,
  Post,
  Body,
  Headers,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { RazorpayService } from 'src/razorpay/razorpay.service';
import { RazorpayWebhookPayload } from 'src/razorpay/types/razorpay-webhook.types';
import { PrismaService } from 'src/prisma/prisma.service';
import { PaymentType } from 'src/razorpay/types/razorpay-payment-link.types';

@Controller('webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly webhookService: WebhookService,
    private readonly razorpayService: RazorpayService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('razorpay')
  async handleRazorpayWebhook(
    @Body() body: RazorpayWebhookPayload,
    @Headers('x-razorpay-signature') signature: string,
  ): Promise<{ status: string }> {
    // Verify signature
    const isValid = this.razorpayService.verifyWebhookSignature(
      JSON.stringify(body),
      signature,
    );
    if (!isValid) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    // Log webhook
    await this.prisma.webhookLog.create({
      data: {
        event: body.event,
        payload: JSON.stringify(body.payload),
        signature,
      },
    });

    // Check payment type from notes and route
    const paymentType = body.payload.payment_link?.entity?.notes
      ?.paymentType as PaymentType | undefined;

    if (paymentType === PaymentType.DRIVER_WALLET) {
      await this.webhookService.handleDriverWebhook(body);
    } else if (paymentType === PaymentType.BOOKING_INVOICE) {
      await this.webhookService.handleBookingWebhook(body);
    }

    return { status: 'ok' };
  }
}
