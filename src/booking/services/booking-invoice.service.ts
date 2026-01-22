import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { Booking, BookingAddress, Customer, Invoice, InvoiceType, Package, PaymentMethod, Prisma, ProductType, VehicleModel, WeightUnit } from '@prisma/client';
import { BookingEstimateRequestDto, BookingEstimateResponseDto } from '../dtos/booking-invoice.dto';
import { PricingService } from '../pricing/pricing.service';
import { PackageDetailsDto } from '../dtos/package.dto';
import { CreateBookingAddressDto } from '../dtos/booking-address.dto';
import * as geolib from 'geolib';
import { PrismaService } from 'src/prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { RazorpayService } from 'src/razorpay/razorpay.service';
import { truncateDecimal, toDecimal, toNumber, minDecimal } from '../utils/decimal.utils';
import { PaymentLinkResponse, PaymentType } from 'src/razorpay/types/razorpay-payment-link.types';

@Injectable()
export class BookingInvoiceService {
  private readonly logger = new Logger(BookingInvoiceService.name);
  private readonly PLATFORM_FEE = 20; // ₹20 platform fee

  constructor(
    private readonly pricingService: PricingService,
    private readonly prisma: PrismaService,
    private readonly razorpayService: RazorpayService,
  ) {}

  /**
   * Create ESTIMATE invoice during booking placement
   */
  async createEstimateInvoice(
    bookingId: string,
    bookingEstimateRequest: BookingEstimateRequestDto,
    walletBalance: number,
    gstNumber: string | null | undefined,
    tx: Prisma.TransactionClient = this.prisma
  ): Promise<Invoice> {
    const estimate = await this.calculateEstimate(bookingEstimateRequest);
    const idealVehicle = estimate.topVehicles[0];

    // Calculate platform fee: ₹20 if no GST, ₹0 if GST provided
    const platformFee = gstNumber ? 0 : this.PLATFORM_FEE;

    // Add platform fee to estimated cost
    const estimatedCostWithFee = idealVehicle.estimatedCost + platformFee;

    // Support both positive (credits) and negative (debt) balances
    const walletBalanceDecimal = toDecimal(walletBalance);
    const estimatedCostDecimal = toDecimal(estimatedCostWithFee);

    let walletApplied: Decimal;
    if (walletBalanceDecimal.isZero()) {
      walletApplied = new Decimal(0);
    } else if (walletBalanceDecimal.greaterThan(0)) {
      walletApplied = minDecimal(walletBalanceDecimal, estimatedCostDecimal);
    } else {
      walletApplied = walletBalanceDecimal; // Apply full debt
    }

    const finalAmount = truncateDecimal(estimatedCostDecimal.minus(walletApplied));

    return tx.invoice.create({
      data: {
        bookingId,
        type: InvoiceType.ESTIMATE,
        vehicleModelName: idealVehicle.vehicleModelName,
        basePrice: idealVehicle.breakdown.baseFare,
        perKmPrice: idealVehicle.breakdown.perKm,
        baseKm: idealVehicle.breakdown.baseKm,
        distanceKm: idealVehicle.breakdown.distanceKm,
        weightInTons: idealVehicle.breakdown.weightInTons,
        effectiveBasePrice: idealVehicle.breakdown.effectiveBasePrice,
        platformFee,
        totalPrice: estimatedCostWithFee,
        gstNumber: gstNumber || null,
        walletApplied: toNumber(walletApplied),
        finalAmount: toNumber(finalAmount),
      },
    });
  }

  /**
   * Create FINAL invoice when driver accepts
   * Uses the driver's actual vehicle model (not the ideal from estimate)
   * Applies wallet balance and updates customer wallet
   */
  async createFinalInvoice(
    booking: Booking & { customer: Customer, pickupAddress: BookingAddress, dropAddress: BookingAddress, package: Package, gstNumber?: string | null },
    vehicleModel: VehicleModel,
    tx: Prisma.TransactionClient
  ): Promise<Invoice> {
    const { customer, pickupAddress, dropAddress, package: packageDetails, gstNumber } = booking;
    const distanceKm = this.calculateDistanceKm(pickupAddress, dropAddress);
    const weightInTons = this.calculateTotalWeightInTons(packageDetails);

    // Calculate pricing using driver's vehicle model
    const pricing = this.pricingService.calculatePrice(
      vehicleModel,
      distanceKm,
      weightInTons,
    );

    // Calculate platform fee: ₹20 if no GST, ₹0 if GST provided
    const platformFee = gstNumber ? 0 : this.PLATFORM_FEE;

    // Add platform fee to total price
    const totalPriceWithFee = pricing.totalPrice + platformFee;

    // Support both positive (credits) and negative (debt) balances
    const walletBalanceDecimal = toDecimal(customer.walletBalance);
    const totalPriceDecimal = toDecimal(totalPriceWithFee);

    let walletApplied: Decimal = new Decimal(0);
    let finalAmount = totalPriceDecimal;

    if (!walletBalanceDecimal.isZero()) {
      // For positive: apply credit (reduce payment)
      // For negative: apply debt (increase payment)
      walletApplied = walletBalanceDecimal.greaterThan(0)
        ? minDecimal(walletBalanceDecimal, totalPriceDecimal)
        : walletBalanceDecimal;

      finalAmount = truncateDecimal(totalPriceDecimal.minus(walletApplied));
      const newBalance = truncateDecimal(walletBalanceDecimal.minus(walletApplied));

      await tx.customer.update({
        where: { id: customer.id },
        data: { walletBalance: toNumber(newBalance) },
      });

      await tx.customerWalletLog.create({
        data: {
          customerId: customer.id,
          beforeBalance: toNumber(walletBalanceDecimal),
          afterBalance: toNumber(newBalance),
          amount: toNumber(walletApplied.negated()),
          reason: walletApplied.greaterThan(0)
            ? `Applied to Booking #${booking.bookingNumber}`
            : `Debt added to Booking #${booking.bookingNumber}`,
          bookingId: booking.id,
        },
      });
    }

    // Create FINAL invoice (payment link will be created asynchronously AFTER transaction commits)
    const invoice = await tx.invoice.create({
      data: {
        bookingId: booking.id,
        type: InvoiceType.FINAL,
        isPaid: finalAmount.lessThanOrEqualTo(0),
        vehicleModelName: vehicleModel.name,
        basePrice: vehicleModel.baseFare,
        perKmPrice: vehicleModel.perKm,
        baseKm: vehicleModel.baseKm,
        distanceKm,
        weightInTons,
        effectiveBasePrice: pricing.effectiveBasePrice,
        platformFee,
        totalPrice: totalPriceWithFee,
        gstNumber: gstNumber || null,
        walletApplied: toNumber(walletApplied),
        finalAmount: toNumber(finalAmount),
        // paymentLinkUrl and rzpPaymentLinkId are NULL
        // They will be populated by createPaymentLinkForInvoice() after transaction commits
      },
    });

    return invoice;
  }

  /**
   * Create payment link for an invoice (called AFTER transaction commits)
   * Updates invoice with payment link details in a separate transaction
   *
   * @returns Payment link details or null if not needed/failed
   */
  async createPaymentLinkForInvoice(
    invoice: Invoice,
    booking: Booking & { customer: Customer }
  ): Promise<PaymentLinkResponse | null> {
    // Skip if already paid or no payment needed
    if (invoice.isPaid || Number(invoice.finalAmount) <= 0) {
      this.logger.log(`Skipping payment link creation for invoice ${invoice.id}: isPaid=${invoice.isPaid}, finalAmount=${invoice.finalAmount}`);
      return null;
    }

    // Check if payment link already exists (idempotency)
    if (invoice.rzpPaymentLinkId && invoice.paymentLinkUrl) {
      this.logger.log(`Payment link already exists for invoice ${invoice.id}`);
      return {
        paymentLinkUrl: invoice.paymentLinkUrl,
        paymentLinkId: invoice.rzpPaymentLinkId,
      };
    }

    // Create payment link via Razorpay
    const customerName = (booking.customer.firstName ?? '') + ' ' + (booking.customer.lastName ?? '');
    const { paymentLinkUrl, paymentLinkId } = await this.razorpayService.createPaymentLink({
      amount: Number(invoice.finalAmount),
      description: `Booking #${booking.bookingNumber} Payment`,
      customerName,
      customerContact: booking.customer.phoneNumber,
      customerEmail: booking.customer.email ?? undefined,
      paymentType: PaymentType.BOOKING_INVOICE,
    });

    // Update invoice with payment link details in a separate transaction
    await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        paymentLinkUrl,
        rzpPaymentLinkId: paymentLinkId,
      },
    });

    this.logger.log(`✓ Payment link created for invoice ${invoice.id}: ${paymentLinkId}`);

    return { paymentLinkUrl, paymentLinkId };
  }

  async calculateEstimate(
    estimateRequest: BookingEstimateRequestDto,
  ): Promise<BookingEstimateResponseDto> {
    // Validate the request
    this.validateEstimateRequest(estimateRequest);

    // Calculate distance
    const distanceKm = this.calculateDistanceKm(
      estimateRequest.pickupAddress,
      estimateRequest.dropAddress
    );

    // Calculate total weight
    const totalWeightInTons = this.calculateTotalWeightInTons(estimateRequest.packageDetails);

    // Use new PricingService to get estimate with top 3 vehicles
    const estimate = await this.pricingService.calculateEstimate(distanceKm, totalWeightInTons);

    return estimate;
  }

  calculateTotalWeightInTons(packageDetails: {approximateWeight: number | Decimal, weightUnit: WeightUnit}): number {
    return this.convertToKg(Number(packageDetails.approximateWeight), packageDetails.weightUnit) / 1000;
  }

  /**
   * Validate estimate request
   */
  private validateEstimateRequest(request: BookingEstimateRequestDto): void {
    this.validateAddresses(request.pickupAddress, request.dropAddress);
    this.validatePackageDetails(request.packageDetails);
  }

  private validateAddresses(pickupAddress: CreateBookingAddressDto, dropAddress: CreateBookingAddressDto): void {
    // Check if addresses are different
    if (
      pickupAddress.latitude === dropAddress.latitude &&
      pickupAddress.longitude === dropAddress.longitude
    ) {
      throw new BadRequestException('Pickup and drop addresses cannot be the same');
    }

    // Validate latitude/longitude ranges
    if (pickupAddress.latitude < -90 || pickupAddress.latitude > 90) {
      throw new BadRequestException('Invalid pickup latitude');
    }
    if (pickupAddress.longitude < -180 || pickupAddress.longitude > 180) {
      throw new BadRequestException('Invalid pickup longitude');
    }
    if (dropAddress.latitude < -90 || dropAddress.latitude > 90) {
      throw new BadRequestException('Invalid drop latitude');
    }
    if (dropAddress.longitude < -180 || dropAddress.longitude > 180) {
      throw new BadRequestException('Invalid drop longitude');
    }
  }

  private validatePackageDetails(packageDetails: PackageDetailsDto): void {
    // Fields are validated by class-validator if present; here we ensure their presence based on product type.
    if (packageDetails.productType === ProductType.PERSONAL) {
      if (!packageDetails.personal) {
        throw new BadRequestException('Personal product details are required');
      }
      return;
    }

    if (packageDetails.productType === ProductType.AGRICULTURAL) {
      // Validate AGRICULTURAL product type (commercial)
      if (!packageDetails.agricultural) {
        throw new BadRequestException('Agricultural product details are required');
      }
      return;
    }

    if (packageDetails.productType === ProductType.NON_AGRICULTURAL) {
      // Validate NON_AGRICULTURAL product type (commercial)
      if (!packageDetails.nonAgricultural) {
        throw new BadRequestException('Non-agricultural product details are required');
      }
    }
  }

  private calculateDistanceKm(
    pickupAddress: {latitude: number | Decimal, longitude: number | Decimal},
    dropAddress: {latitude: number | Decimal, longitude: number | Decimal}
  ): number {
    const distance = geolib.getDistance(
      { latitude: Number(pickupAddress.latitude), longitude: Number(pickupAddress.longitude) },
      { latitude: Number(dropAddress.latitude), longitude: Number(dropAddress.longitude) },
    );
    return distance / 1000; // Convert meters to km
  }

  private convertToKg(weight: number, unit: WeightUnit): number {
    switch (unit) {
      case WeightUnit.KG:
        return weight;
      case WeightUnit.QUINTAL:
        return weight * 100;
      default:
        throw new BadRequestException('Invalid weight unit');
    }
  }
}
