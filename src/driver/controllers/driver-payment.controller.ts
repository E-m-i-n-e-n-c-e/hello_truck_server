import {
  Controller,
  Post,
  Body,
  Headers,
  UseGuards,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle, seconds } from '@nestjs/throttler';
import { DriverPaymentService } from '../payment/payment.service';
import { DriverPayoutService } from '../payment/payout.service';
import { RazorpayService } from 'src/razorpay/razorpay.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { AccessTokenGuard } from 'src/token/guards/access-token.guard';
import { RolesGuard } from 'src/token/guards/roles.guard';
import { Roles } from 'src/token/decorators/roles.decorator';
import { User } from 'src/token/decorators/user.decorator';
import { RazorpayWebhookPayload } from 'src/razorpay/types/razorpay-webhook.types';
import { Serialize } from 'src/common/interceptors/serialize.interceptor';
import {
  PaymentLinkResponseDto,
  GeneratePaymentLinkDto,
  WithdrawalRequestDto,
} from '../payment/dtos/driver-payment.dto';

@Controller('driver/payment')
export class DriverPaymentController {
  private readonly logger = new Logger(DriverPaymentController.name);

  constructor(
    private readonly driverPaymentService: DriverPaymentService,
    private readonly driverPayoutService: DriverPayoutService,
    private readonly razorpayService: RazorpayService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('link')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles('driver')
  @Serialize(PaymentLinkResponseDto)
  async generatePaymentLink(
    @User('userId') driverId: string,
    @Body() dto: GeneratePaymentLinkDto,
  ) {
    return this.driverPaymentService.generatePaymentLink(driverId, dto.amount);
  }

  @Post('withdraw')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles('driver')
  @Throttle({ default: { ttl: seconds(60), limit: 1 } })
  async requestWithdrawal(
    @User('userId') driverId: string,
    @Body() dto: WithdrawalRequestDto,
  ) {
    await this.driverPayoutService.processWithdrawal(driverId, dto.amount);
    return { message: 'Withdrawal processed successfully' };
  }

  @Post('webhook')
  async handleWebhook(
    @Body() body: RazorpayWebhookPayload,
    @Headers('x-razorpay-signature') signature: string,
  ): Promise<{ status: string }> {
    this.logger.log('Received driver payment webhook');

    // Verify signature
    const isValid = this.razorpayService.verifyWebhookSignature(
      JSON.stringify(body),
      signature,
    );
    if (!isValid) {
      this.logger.warn('Invalid webhook signature');
      throw new UnauthorizedException('Invalid signature');
    }

    // Log webhook
    await this.prisma.webhookLog.create({
      data: {
        event: body.event,
        payload: JSON.stringify(body.payload),
        signature,
      },
    });

    const event = body.event;
    const paymentLink = body.payload.payment_link?.entity;
    const payment = body.payload.payment?.entity;

    // Get referenceId from payment link - this is our lookup key
    const referenceId = paymentLink?.reference_id;
    if (!referenceId) {
      return { status: 'ok' };
    }

    if (
      event === 'payment_link.paid' ||
      event === 'payment_link.partially_paid'
    ) {
      const amountPaid = (payment?.amount ?? 0) / 100; // Convert paise to rupees
      await this.driverPaymentService.handlePaymentReceived(
        referenceId,
        payment?.id ?? '',
        amountPaid,
      );
    } else if (event === 'payment_link.expired') {
      await this.driverPaymentService.handleLinkExpired(referenceId);
    }

    return { status: 'ok' };
  }
}
