import { Injectable, BadRequestException } from '@nestjs/common';
import { ProductType, VehicleType, WeightUnit } from '@prisma/client';
import { BookingEstimateRequestDto, BookingEstimateResponseDto } from '../dtos/booking-estimate.dto';
import { PricingService } from '../pricing/pricing.service';
import { AgriculturalProductDto, NonAgriculturalProductDto, PackageDetailsDto, PersonalProductDto } from '../dtos/package.dto';
import * as geolib from 'geolib';

@Injectable()
export class BookingEstimateService {
  constructor(private readonly pricingService: PricingService) {}

  /**
   * Calculate booking estimate
   */
   calculateEstimate(
    estimateRequest: BookingEstimateRequestDto,
  ): BookingEstimateResponseDto {
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

  private calculateTotalWeight(packageDetails: PackageDetailsDto): number {
    return this.convertToKg(packageDetails.approximateWeight, packageDetails.weightUnit);    
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
