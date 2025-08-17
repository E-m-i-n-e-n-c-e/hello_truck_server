import { Injectable } from '@nestjs/common';
import { getPreciseDistance } from 'geolib';
import { VehicleType, WeightUnit } from '@prisma/client';

@Injectable()
export class PricingService {
  // Base pricing configuration
  private readonly BASE_FARE = 100.00;
  private readonly PER_KM_RATE = 50.00;

  // Weight multipliers based on actual weight ranges
  private getWeightMultiplier(totalWeightInKg: number): number {
    if (totalWeightInKg <= 50) return 1.0;      // Light packages
    if (totalWeightInKg <= 200) return 1.1;     // Medium packages
    if (totalWeightInKg <= 500) return 1.2;     // Heavy packages
    return 1.5;                                 // Very heavy packages
  }

  // Vehicle type multipliers
  private readonly VEHICLE_MULTIPLIERS = {
    [VehicleType.TWO_WHEELER]: 1.0,
    [VehicleType.THREE_WHEELER]: 1.2,
    [VehicleType.FOUR_WHEELER]: 1.5,
  };

  // Weight limits for each vehicle type (in KG)
  private readonly WEIGHT_LIMITS = {
    [VehicleType.TWO_WHEELER]: 50,
    [VehicleType.THREE_WHEELER]: 500,
    [VehicleType.FOUR_WHEELER]: 2000,
  };

  /**
   * Calculate precise distance between two points using geolib
   */
  calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const distanceInMeters = getPreciseDistance(
      { latitude: lat1, longitude: lon1 },
      { latitude: lat2, longitude: lon2 }
    );

    return distanceInMeters / 1000; // Convert to kilometers
  }

  /**
   * Suggest vehicle type based on package details
   */
  suggestVehicleType(
    productType: any,
    weight?: number,
    weightUnit?: WeightUnit,
    numberOfProducts?: number
  ): VehicleType {
    let totalWeightInKg = 0;

    // Calculate total weight
    if (weight && weightUnit) {
      totalWeightInKg = weightUnit === WeightUnit.KG ? weight : weight * 100;
    }

    // For non-agricultural products, consider number of products
    if (productType === 'NON_AGRICULTURAL' && numberOfProducts) {
      totalWeightInKg = totalWeightInKg * numberOfProducts;
    }

    // Suggest vehicle based on weight
    if (totalWeightInKg <= 50) {
      return VehicleType.TWO_WHEELER;
    } else if (totalWeightInKg <= 500) {
      return VehicleType.THREE_WHEELER;
    } else {
      return VehicleType.FOUR_WHEELER;
    }
  }

  /**
   * Get vehicle multiplier
   */
  getVehicleMultiplier(vehicleType: VehicleType): number {
    return this.VEHICLE_MULTIPLIERS[vehicleType] || 1.0;
  }

  /**
   * Get weight limit for vehicle type
   */
  getWeightLimit(vehicleType: VehicleType): number {
    return this.WEIGHT_LIMITS[vehicleType] || 0;
  }

  /**
   * Calculate pricing breakdown
   */
  calculatePricing(
    distanceKm: number,
    suggestedVehicleType: VehicleType,
    totalWeightInKg: number,
  ) {
    const baseFare = this.BASE_FARE;
    const distanceCharge = distanceKm * this.PER_KM_RATE;
    const weightMultiplier = this.getWeightMultiplier(totalWeightInKg);
    const vehicleMultiplier = this.getVehicleMultiplier(suggestedVehicleType);
    const totalMultiplier = weightMultiplier * vehicleMultiplier;

    const estimatedCost = (baseFare + distanceCharge) * totalMultiplier;

    return {
      estimatedCost: Math.round(estimatedCost * 100) / 100,
      distanceKm: Math.round(distanceKm * 100) / 100,
      suggestedVehicleType,
      breakdown: {
        baseFare,
        distanceCharge,
        weightMultiplier,
        vehicleMultiplier,
        totalMultiplier,
      },
    };
  }

  /**
   * Calculate pricing for all vehicle types
   */
  calculateAllVehiclePricing(
    distanceKm: number,
    totalWeightInKg: number,
  ) {
    const baseFare = this.BASE_FARE;
    const distanceCharge = distanceKm * this.PER_KM_RATE;
    const weightMultiplier = this.getWeightMultiplier(totalWeightInKg);

    const vehicleOptions = Object.values(VehicleType).map(vehicleType => {
      const vehicleMultiplier = this.getVehicleMultiplier(vehicleType);
      const totalMultiplier = weightMultiplier * vehicleMultiplier;
      const weightLimit = this.getWeightLimit(vehicleType);

      // Check if vehicle can handle the weight
      const isAvailable = totalWeightInKg <= weightLimit;

      const estimatedCost = isAvailable
        ? (baseFare + distanceCharge) * totalMultiplier
        : 0;

      return {
        vehicleType,
        estimatedCost: Math.round(estimatedCost * 100) / 100,
        isAvailable,
        weightLimit,
        breakdown: {
          baseFare,
          distanceCharge,
          weightMultiplier,
          vehicleMultiplier,
          totalMultiplier,
        },
      };
    });

    return vehicleOptions;
  }
}
