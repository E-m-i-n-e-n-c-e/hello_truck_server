import { Injectable, BadRequestException } from '@nestjs/common';
import { ProductType, VehicleType, WeightUnit } from '@prisma/client';
import { BookingEstimateRequestDto, BookingEstimateResponseDto } from '../dtos/booking-estimate.dto';
import { PricingService } from '../pricing/pricing.service';
import { PackageDetailsDto } from '../dtos/package.dto';
import * as geolib from 'geolib';

@Injectable()
export class BookingEstimateService {
  constructor(private readonly pricingService: PricingService) {}

  /**
   * Calculate booking estimate
   */
  async calculateEstimate(
    userId: string,
    estimateRequest: BookingEstimateRequestDto,
  ): Promise<BookingEstimateResponseDto> {
    // Validate the request
    this.validateEstimateRequest(estimateRequest);

    // Calculate distance
    const distance = geolib.getDistance(
      { latitude: estimateRequest.pickupAddress.latitude, longitude: estimateRequest.pickupAddress.longitude },
      { latitude: estimateRequest.dropAddress.latitude, longitude: estimateRequest.dropAddress.longitude },
    );
    const distanceKm = distance / 1000; // Convert to km

    // Calculate total weight using pricing service
    const totalWeightInKg = this.calculateTotalWeight(estimateRequest.packageDetails);

    // Validate vehicle suitability
    this.validateVehicleSuitability(totalWeightInKg);

    const suggestedVehicleType = this.pricingService.suggestVehicleType(
      estimateRequest.packageDetails.productType as any,
      totalWeightInKg,
      'KG' as any,
      1,
    );

    // Calculate pricing for all vehicle types
    const vehicleOptions = this.pricingService.calculateAllVehiclePricing(
      distanceKm,
      totalWeightInKg,
    );

    return {
      distanceKm: Math.round(distanceKm * 100) / 100,
      suggestedVehicleType,
      vehicleOptions,
    };
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

  private validatePackageDetails(packageDetails: any): void {
    if (packageDetails.productType === 'AGRICULTURAL') {
      if (!packageDetails.agricultural) {
        throw new BadRequestException('Agricultural product details are required');
      }
      if (!packageDetails.agricultural.productName) {
        throw new BadRequestException('Product name is required for agricultural products');
      }
      if (!packageDetails.agricultural.approximateWeight || packageDetails.agricultural.approximateWeight <= 0) {
        throw new BadRequestException('Valid approximate weight is required for agricultural products');
      }
    } else if (packageDetails.productType === 'NON_AGRICULTURAL') {
      if (!packageDetails.nonAgricultural) {
        throw new BadRequestException('Non-agricultural product details are required');
      }

      const hasWeight = packageDetails.nonAgricultural.averageWeight || packageDetails.nonAgricultural.bundleWeight;
      const hasDimensions = packageDetails.nonAgricultural.packageDimensions;
      const hasDescription = packageDetails.nonAgricultural.packageDescription;

      if (!hasWeight && !hasDimensions && !hasDescription) {
        throw new BadRequestException('At least one of weight, dimensions, or description is required for non-agricultural products');
      }
    }
  }

  private calculateTotalWeight(packageDetails: PackageDetailsDto): number {
    let totalWeightInKg = 0;

    if (packageDetails.productType === ProductType.AGRICULTURAL) {
      const agricultural = packageDetails.agricultural;
      if (agricultural) {
        totalWeightInKg = agricultural.weightUnit === WeightUnit.KG
          ? agricultural.approximateWeight
          : agricultural.approximateWeight * 100;
      }
    } else {
      const nonAgricultural = packageDetails.nonAgricultural;
      if (nonAgricultural) {
        const weight = nonAgricultural.averageWeight || nonAgricultural.bundleWeight || 0;
        const numberOfProducts = nonAgricultural.numberOfProducts || 1;
        totalWeightInKg = weight * numberOfProducts;
      }
    }

    return totalWeightInKg;
  }

  private validateVehicleSuitability(totalWeightInKg: number): void {
    if (totalWeightInKg > 0) {
      const availableVehicles = Object.values(VehicleType).filter(vehicleType => {
        const weightLimit = this.pricingService.getWeightLimit(vehicleType);
        return totalWeightInKg <= weightLimit;
      });

      if (availableVehicles.length === 0) {
        throw new BadRequestException(
          `Package weight (${totalWeightInKg}kg) exceeds the limit for all available vehicle types`
        );
      }
    }
  }
}
