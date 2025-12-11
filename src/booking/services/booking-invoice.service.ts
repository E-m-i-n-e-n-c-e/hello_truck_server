import { Injectable, BadRequestException } from '@nestjs/common';
import { BookingAddress, Invoice, InvoiceType, Package, Prisma, ProductType, VehicleModel, WeightUnit } from '@prisma/client';
import { BookingEstimateRequestDto, BookingEstimateResponseDto } from '../dtos/booking-estimate.dto';
import { PricingService } from '../pricing/pricing.service';
import { PackageDetailsDto, PersonalProductDto } from '../dtos/package.dto';
import * as geolib from 'geolib';
import { PrismaService } from 'src/prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class BookingInvoiceService {
  constructor(
    private readonly pricingService: PricingService,
    private readonly prisma: PrismaService,
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

    // Apply wallet balance to estimate
    const walletApplied = Math.min(
      Math.max(0, walletBalance), // Only positive wallet balance
      idealVehicle.estimatedCost,
    );
    const finalAmount = idealVehicle.estimatedCost - walletApplied;

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
    bookingId: string,
    customerId: string,
    vehicleModel: VehicleModel,
    pickupAddress: BookingAddress,
    dropAddress: BookingAddress,
    packageDetails: Package,
    tx: Prisma.TransactionClient = this.prisma
  ): Promise<Invoice> {

    const distanceKm = this.calculateDistanceKm(pickupAddress, dropAddress);
    const weightInTons = this.calculateTotalWeightInTons(packageDetails);

    // Calculate pricing using driver's vehicle model
    const pricing = this.pricingService.calculatePrice(
      vehicleModel,
      distanceKm,
      weightInTons,
    );

    // Get customer for wallet balance
    const customer = await tx.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new BadRequestException('Customer not found');
    }

    // Apply wallet balance
    const walletBalance = Number(customer.walletBalance);
    const walletApplied = Math.min(
      Math.max(0, walletBalance),
      pricing.totalPrice
    );
    const finalAmount = pricing.totalPrice - walletApplied;

    // Create FINAL invoice
    const invoice = await tx.invoice.create({
      data: {
        bookingId,
        type: InvoiceType.FINAL,
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
        // TODO: Add Razorpay payment link generation here
        // paymentLinkUrl: paymentLink.url,
        // rzpOrderId: paymentLink.orderId,
      },
    });

    // Update customer wallet balance
    if (walletApplied > 0) {
      await tx.customer.update({
        where: { id: customerId },
        data: { walletBalance: walletBalance - walletApplied },
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

  /**
   * Validate estimate request
   */
  private validateEstimateRequest(request: BookingEstimateRequestDto): void {
    this.validateAddresses(request.pickupAddress, request.dropAddress);
    this.validatePackageDetails(request.packageDetails);
  }

  private validateAddresses(pickupAddress: any, dropAddress: any): void {
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

  calculateTotalWeightInTons(packageDetails: {approximateWeight: number | Decimal, weightUnit: WeightUnit}): number {
    return this.convertToKg(Number(packageDetails.approximateWeight), packageDetails.weightUnit) / 1000;    
  }
}
