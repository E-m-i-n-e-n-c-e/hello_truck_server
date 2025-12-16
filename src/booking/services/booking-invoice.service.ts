import { Injectable, BadRequestException } from '@nestjs/common';
import { Booking, BookingAddress, Customer, Invoice, InvoiceType, Package, Prisma, ProductType, VehicleModel, WeightUnit } from '@prisma/client';
import { BookingEstimateRequestDto, BookingEstimateResponseDto } from '../dtos/booking-invoice.dto';
import { PricingService } from '../pricing/pricing.service';
import { PackageDetailsDto } from '../dtos/package.dto';
import { CreateBookingAddressDto } from '../dtos/booking-address.dto';
import * as geolib from 'geolib';
import { PrismaService } from 'src/prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { RazorpayService } from 'src/razorpay/razorpay.service';
import { truncate2 } from '../utils/general.utils';

@Injectable()
export class BookingInvoiceService {
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
    tx: Prisma.TransactionClient = this.prisma
  ): Promise<Invoice> {
    const estimate = await this.calculateEstimate(bookingEstimateRequest);
    const idealVehicle = estimate.topVehicles[0];

    // Support both positive (credits) and negative (debt) balances
    const walletApplied = walletBalance !== 0
      ? (walletBalance > 0
          ? Math.min(walletBalance, idealVehicle.estimatedCost)
          : walletBalance)
      : 0;

    const finalAmount = truncate2(idealVehicle.estimatedCost - walletApplied);

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
        totalPrice: idealVehicle.estimatedCost,
        walletApplied,
        finalAmount,
      },
    });
  }

  /**
   * Create FINAL invoice when driver accepts
   * Uses the driver's actual vehicle model (not the ideal from estimate)
   * Applies wallet balance and updates customer wallet
   */
  async createFinalInvoice(
    booking: Booking & { customer: Customer, pickupAddress: BookingAddress, dropAddress: BookingAddress, package: Package },
    vehicleModel: VehicleModel,
    tx: Prisma.TransactionClient
  ): Promise<Invoice> {
    const { customer, pickupAddress, dropAddress, package: packageDetails } = booking;
    const distanceKm = this.calculateDistanceKm(pickupAddress, dropAddress);
    const weightInTons = this.calculateTotalWeightInTons(packageDetails);

    // Calculate pricing using driver's vehicle model
    const pricing = this.pricingService.calculatePrice(
      vehicleModel,
      distanceKm,
      weightInTons,
    );

    // Support both positive (credits) and negative (debt) balances
    const walletBalance = Number(customer.walletBalance);
    let walletApplied = 0;
    let finalAmount = pricing.totalPrice;

    if (walletBalance !== 0) {
      // For positive: apply credit (reduce payment)
      // For negative: apply debt (increase payment)
      walletApplied = walletBalance > 0
        ? Math.min(walletBalance, pricing.totalPrice)
        : walletBalance;

      finalAmount = truncate2(pricing.totalPrice - walletApplied);
      const newBalance = truncate2(walletBalance - walletApplied);

      await tx.customer.update({
        where: { id: customer.id },
        data: { walletBalance: newBalance },
      });

      await tx.customerWalletLog.create({
        data: {
          customerId: customer.id,
          beforeBalance: walletBalance,
          afterBalance: newBalance,
          amount: -walletApplied,
          reason: walletApplied > 0
            ? `Applied to Booking #${booking.bookingNumber}`
            : `Debt added to Booking #${booking.bookingNumber}`,
          bookingId: booking.id,
        },
      });
    }

    // Create FINAL invoice FIRST (so we have invoice.id for payment link reference_id)
    const invoice = await tx.invoice.create({
      data: {
        bookingId: booking.id,
        type: InvoiceType.FINAL,
        isPaid: finalAmount <= 0,
        vehicleModelName: vehicleModel.name,
        basePrice: vehicleModel.baseFare,
        perKmPrice: vehicleModel.perKm,
        baseKm: vehicleModel.baseKm,
        distanceKm,
        weightInTons,
        effectiveBasePrice: pricing.effectiveBasePrice,
        totalPrice: pricing.totalPrice,
        walletApplied,
        finalAmount,
        // Payment link fields will be updated below if needed
      },
    });

    // Generate payment link AFTER invoice creation (use invoice.id as reference_id)
    if (finalAmount > 0) {
      const { paymentLinkUrl, paymentLinkId } = await this.razorpayService.createPaymentLink({
        amount: finalAmount,
        description: `Booking #${booking.bookingNumber} Payment`,
        customerName: customer.firstName || customer.phoneNumber,
        customerContact: customer.phoneNumber,
        customerEmail: customer.email ?? undefined,
        referenceId: invoice.id, // Use invoice ID
      });

      // Update invoice with payment link details
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          paymentLinkUrl,
          rzpPaymentLinkId: paymentLinkId,
        },
      });
    }

    return invoice;
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
