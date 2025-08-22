import { Injectable } from '@nestjs/common';
import { getPreciseDistance } from 'geolib';
import { VehicleType, WeightUnit } from '@prisma/client';

@Injectable()
export class PricingService {
  // Base pricing configuration
  private readonly BASE_FARE = 100.00;
  private readonly PER_KM_RATE = 50.00;

  // Distance-based pricing tiers for better competitiveness
  private getDistanceMultiplier(distanceKm: number): number {
    if (distanceKm <= 5) return 1.0;      // Local delivery
    if (distanceKm <= 15) return 0.95;    // Short distance discount
    if (distanceKm <= 50) return 0.90;    // Medium distance discount
    if (distanceKm <= 100) return 0.85;   // Long distance discount
    return 0.80;                          // Very long distance discount
  }

  // Weight multipliers based on actual weight ranges - more granular
  private getWeightMultiplier(totalWeightInKg: number): number {
    if (totalWeightInKg <= 10) return 1.0;     // Very light packages
    if (totalWeightInKg <= 25) return 1.05;    // Light packages
    if (totalWeightInKg <= 50) return 1.1;     // Medium-light packages
    if (totalWeightInKg <= 100) return 1.15;   // Medium packages
    if (totalWeightInKg <= 200) return 1.25;   // Medium-heavy packages
    if (totalWeightInKg <= 500) return 1.4;    // Heavy packages
    if (totalWeightInKg <= 1000) return 1.6;   // Very heavy packages
    return 1.8;                                // Extremely heavy packages
  }

  // Vehicle type multipliers - more realistic pricing
  private readonly VEHICLE_MULTIPLIERS = {
    [VehicleType.TWO_WHEELER]: 0.8,    // Most economical
    [VehicleType.THREE_WHEELER]: 1.0,  // Standard pricing
    [VehicleType.FOUR_WHEELER]: 1.3,   // Premium service
  };

  // Weight limits for each vehicle type (in KG) - more realistic
  private readonly WEIGHT_LIMITS = {
    [VehicleType.TWO_WHEELER]: 25,     // Reduced for safety
    [VehicleType.THREE_WHEELER]: 300,  // More realistic limit
    [VehicleType.FOUR_WHEELER]: 1500,  // Realistic truck capacity
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

    // Suggest vehicle based on weight with safety margins
    if (totalWeightInKg <= 10) {
      return VehicleType.TWO_WHEELER;
    } else if (totalWeightInKg <= 50) {
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
