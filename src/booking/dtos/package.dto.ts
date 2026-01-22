import {
  $Enums,
  DimensionUnit,
  Package,
  ProductType,
  WeightUnit,
} from '@prisma/client';
import { Expose, Type } from 'class-transformer';
import {
  IsOptional,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsString,
  ValidateNested,
  Min,
} from 'class-validator';

// Personal Product DTO (for PERSONAL product type)
export class PersonalProductDto {
  @IsString()
  @IsNotEmpty()
  productName: string;
}

// Agricultural Product DTO (for AGRICULTURAL product type - commercial)
export class AgriculturalProductDto {
  @IsString()
  @IsNotEmpty()
  productName: string;

  @IsString()
  @IsNotEmpty()
  gstBillUrl: string;
}

class PackageDimensionsDto {
  @IsNumber()
  @Min(0)
  length: number;

  @IsNumber()
  @Min(0)
  width: number;

  @IsNumber()
  @Min(0)
  height: number;

  @IsEnum(DimensionUnit)
  unit: DimensionUnit;
}

// Non-Agricultural Product DTO (for NON_AGRICULTURAL product type - commercial)
export class NonAgriculturalProductDto {
  @IsNumber()
  @Min(0)
  bundleWeight: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  numberOfProducts?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => PackageDimensionsDto)
  packageDimensions?: PackageDimensionsDto;

  @IsOptional()
  @IsString()
  packageDescription?: string;

  @IsString()
  @IsNotEmpty()
  gstBillUrl: string;
}

export class PackageDetailsDto {
  @IsEnum(ProductType)
  productType: ProductType;

  @IsNumber()
  @Min(0)
  approximateWeight: number;

  @IsEnum(WeightUnit)
  weightUnit: WeightUnit;

  @IsOptional()
  @ValidateNested()
  @Type(() => PersonalProductDto)
  personal?: PersonalProductDto;

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
  packageImageUrl?: string;

  @IsOptional()
  @IsString({ each: true })
  transportDocUrls?: string[];
}

export class UpdatePackageDetailsDto {
  @IsOptional()
  @IsEnum(ProductType)
  productType?: ProductType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  approximateWeight?: number;

  @IsOptional()
  @IsEnum(WeightUnit)
  weightUnit?: WeightUnit;

  @IsOptional()
  @ValidateNested()
  @Type(() => PersonalProductDto)
  personal?: PersonalProductDto;

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
  packageImageUrl?: string;

  @IsOptional()
  @IsString({ each: true })
  transportDocUrls?: string[];
}

export class PackageDetailsResponseDto {
  @Expose()
  id: string;
  @Expose()
  productType: $Enums.ProductType;
  @Expose()
  approximateWeight: number;
  @Expose()
  weightUnit: $Enums.WeightUnit;

  @Expose()
  productName?: string;

  @Expose()
  bundleWeight?: number;
  @Expose()
  numberOfProducts?: number;
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
  transportDocUrls: string[];
  @Expose()
  gstBillUrl?: string;

  @Expose()
  createdAt: Date;
  @Expose()
  updatedAt: Date;
}
