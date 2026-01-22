import { Injectable, Logger } from '@nestjs/common';
import { DriverPaymentService } from 'src/driver/payment/payment.service';
import { BookingPaymentService } from 'src/booking/services/booking-payment.service';
import { RazorpayWebhookPayload } from 'src/razorpay/types/razorpay-webhook.types';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly driverPaymentService: DriverPaymentService,
    private readonly bookingPaymentService: BookingPaymentService,
  ) {}

  /**
   * Handle driver wallet webhook
   * Delegates to existing DriverPaymentService methods
   */
  async handleDriverWebhook(body: RazorpayWebhookPayload): Promise<void> {
    const event = body.event;
    const paymentLink = body.payload.payment_link?.entity;
    const payment = body.payload.payment?.entity;
    const referenceId = paymentLink?.reference_id;

    if (!referenceId) {
      this.logger.warn('No referenceId found for driver webhook');
      return;
    }

    if (event === 'payment_link.paid' || event === 'payment_link.partially_paid') {
      const amountPaid = (payment?.amount ?? 0) / 100; // Convert paise to rupees
      await this.driverPaymentService.handlePaymentReceived(
        referenceId,
        payment?.id ?? '',
        amountPaid,
      );
    } else if (event === 'payment_link.expired') {
      await this.driverPaymentService.handleLinkExpired(referenceId);
    }
  }

  /**
   * Handle booking invoice webhook
   * Delegates to existing BookingPaymentService
   */
  async handleBookingWebhook(body: RazorpayWebhookPayload): Promise<void> {
    const event = body.event;
    const paymentLink = body.payload.payment_link?.entity;
    const payment = body.payload.payment?.entity;

    if (event === 'payment_link.paid') {
      const rzpPaymentLinkId = paymentLink?.id;
      if (!rzpPaymentLinkId) {
        this.logger.error('No payment link ID found in booking webhook');
        return;
      }

      const rzpPaymentId = payment?.id ?? '';
      await this.bookingPaymentService.handlePaymentSuccess(rzpPaymentLinkId, rzpPaymentId);
    }
  }
}
