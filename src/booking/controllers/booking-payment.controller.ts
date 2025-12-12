import { Controller, Post, Body, Headers, UnauthorizedException, Logger } from '@nestjs/common';
import { BookingPaymentService } from '../services/booking-payment.service';
import { RazorpayService } from 'src/razorpay/razorpay.service';
import { RazorpayWebhookPayload } from 'src/razorpay/types/razorpay-webhook.types';
import { PrismaService } from 'src/prisma/prisma.service';

@Controller('bookings/webhook')
export class BookingPaymentController {
  private readonly logger = new Logger(BookingPaymentController.name);

  constructor(
    private readonly bookingPaymentService: BookingPaymentService,
    private readonly razorpayService: RazorpayService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('razorpay')
  async handleRazorpayWebhook(
    @Body() body: RazorpayWebhookPayload,
    @Headers('x-razorpay-signature') signature: string,
  ): Promise<{ status: string; message?: string }> {
    this.logger.log('Received Razorpay webhook');

    // Verify webhook signature
    const rawBody = JSON.stringify(body);
    const isValid = this.razorpayService.verifyWebhookSignature(rawBody, signature);
    
    if (!isValid) {
      this.logger.warn('Invalid webhook signature');
      throw new UnauthorizedException('Invalid webhook signature');
    }

    const event = body.event;
    const payload = body.payload;

    // Log webhook to database for audit trail
    await this.prisma.webhookLog.create({
      data: {
        event,
        payload: JSON.stringify(payload),
        signature,
      },
    });

    this.logger.log(`Processing webhook event: ${event}`);

    // Handle payment link paid event
    if (event === 'payment_link.paid') {
      const paymentLinkEntity = payload.payment_link.entity;
      const paymentEntity = payload.payment.entity;
      
      // Extract reference_id (our bookingId)
      const bookingId = paymentLinkEntity.reference_id;
      const rzpPaymentId = paymentEntity.id;
      const rzpPaymentLinkId = paymentLinkEntity.id;
      
      if (!bookingId) {
        this.logger.error('No reference_id (bookingId) found in payment link webhook');
        return { status: 'error', message: 'No reference_id' };
      }
      
      await this.bookingPaymentService.handlePaymentSuccess(bookingId, rzpPaymentId, rzpPaymentLinkId);
    }

    return { status: 'ok' };
  }
}
