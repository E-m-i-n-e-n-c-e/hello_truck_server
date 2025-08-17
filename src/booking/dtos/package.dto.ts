import { $Enums, PackageType, ProductType, WeightUnit } from "@prisma/client";
import { Expose, Type } from "class-transformer";
import { IsOptional, IsEnum, IsNotEmpty, IsNumber, IsString, ValidateNested } from "class-validator";

export class AgriculturalProductDto {
  @IsString()
  @IsNotEmpty()
  productName: string;

  @IsNumber()
  approximateWeight: number;

  @IsEnum(WeightUnit)
  weightUnit: WeightUnit;
}

export class NonAgriculturalProductDto {
  @IsOptional()
  @IsNumber()
  averageWeight?: number;

  @IsOptional()
  @IsNumber()
  bundleWeight?: number;

  @IsOptional()
  @IsNumber()
  numberOfProducts?: number;

  @IsOptional()
  packageDimensions?: any;

  @IsOptional()
  @IsString()
  packageDescription?: string;

  @IsOptional()
  packageImageUrl?: string;
}

export class PackageDetailsDto {
  @IsEnum(PackageType)
  packageType: PackageType;

  @IsEnum(ProductType)
  productType: ProductType;

  @IsOptional()
  @ValidateNested()
  @Type(() => AgriculturalProductDto)
  agricultural?: AgriculturalProductDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => NonAgriculturalProductDto)
  nonAgricultural?: NonAgriculturalProductDto;

  @IsOptional()
  @IsString()
  gstBillUrl?: string;

  @IsOptional()
  @IsString({ each: true })
  transportDocUrls?: string[];
}

export class PackageDetailsResponseDto {
  @Expose()
  productName?: string;
  @Expose()
  approximateWeight?: number;
  @Expose()
  weightUnit: $Enums.WeightUnit;
  @Expose()
  averageWeight?: number;
  @Expose()
  bundleWeight?: number;
  @Expose()
  numberOfProducts?: number;
  @Expose()
  packageType: $Enums.PackageType;
  @Expose()
  productType: $Enums.ProductType;
  @Expose()
  gstBillUrl?: string;
  @Expose()
  transportDocUrls?: string[];
  @Expose()
  id: string;
  @Expose()
  length?: number;
  @Expose()
  width?: number;
  @Expose()
  height?: number;
  @Expose()
  dimensionUnit?: $Enums.DimensionUnit;
  @Expose()
  description?: string;
  @Expose()
  packageImageUrl?: string;
  @Expose()
  createdAt: Date;
  @Expose()
  updatedAt: Date;
}