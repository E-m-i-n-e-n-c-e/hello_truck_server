import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { VehicleModel } from '@prisma/client';

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculate price for a specific vehicle model
   * Formula:
   * - effectiveBasePrice = baseFare * min(1, weightInTons)
   * - price = max(distance - baseKm, 0) * perKm + effectiveBasePrice
   */
  calculatePrice(
    vehicleModel: VehicleModel,
    distanceKm: number,
    weightInTons: number,
  ): {
    effectiveBasePrice: number;
    totalPrice: number;
    breakdown: {
      baseFare: number;
      baseKm: number;
      perKm: number;
      distanceKm: number;
      weightInTons: number;
      effectiveBasePrice: number;
    };
  } {
    const baseFare = Number(vehicleModel.baseFare);
    const perKm = Number(vehicleModel.perKm);
    const baseKm = vehicleModel.baseKm;

    // effectiveBasePrice = baseFare * max(1, weightInTons)
    const effectiveBasePrice = baseFare * Math.max(1, weightInTons);

    // price = max(distance - baseKm, 0) * perKm + effectiveBasePrice
    const extraDistance = Math.max(distanceKm - baseKm, 0);
    const totalPrice = extraDistance * perKm + effectiveBasePrice;

    return {
      effectiveBasePrice: Math.round(effectiveBasePrice * 100) / 100,
      totalPrice: Math.round(totalPrice * 100) / 100,
      breakdown: {
        baseFare,
        baseKm,
        perKm,
        distanceKm,
        weightInTons,
        effectiveBasePrice: Math.round(effectiveBasePrice * 100) / 100,
      },
    };
  }

  /**
   * Get all vehicle models that can handle the given weight
   */
  async getSuitableVehicles(weightInTons: number): Promise<VehicleModel[]> {
    return this.prisma.vehicleModel.findMany({
      where: {
        maxWeightTons: { gte: weightInTons },
      },
      orderBy: { maxWeightTons: 'asc' },
    });
  }

  /**
   * Calculate estimate with top 3 best vehicle models
   */
  async calculateEstimate(
    distanceKm: number,
    weightInTons: number,
  ): Promise<{
    distanceKm: number;
    idealVehicleModel: string;
    topVehicles: Array<{
      vehicleModelName: string;
      estimatedCost: number;
      maxWeightTons: number;
      breakdown: any;
    }>;
  }> {
    // Get all suitable vehicle models
    const suitableVehicles = await this.getSuitableVehicles(weightInTons);

    if (suitableVehicles.length === 0) {
      throw new BadRequestException(
        `No vehicle can handle ${weightInTons} tons. Maximum capacity is 25 tons.`,
      );
    }

    // Calculate price for each and sort by price
    const vehiclesWithPrices = suitableVehicles
      .map((vehicle) => {
        const pricing = this.calculatePrice(vehicle, distanceKm, weightInTons);
        return {
          vehicleModelName: vehicle.name,
          estimatedCost: pricing.totalPrice,
          maxWeightTons: Number(vehicle.maxWeightTons),
          breakdown: pricing.breakdown,
        };
      })
      .sort((a, b) => a.estimatedCost - b.estimatedCost);

    // Return top 3
    const topVehicles = vehiclesWithPrices.slice(0, 3);

    return {
      distanceKm: Math.round(distanceKm * 100) / 100,
      idealVehicleModel: topVehicles[0].vehicleModelName,
      topVehicles,
    };
  }
}
