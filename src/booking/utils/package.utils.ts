import { BadRequestException } from '@nestjs/common';
import { Package, Prisma, ProductType } from '@prisma/client';
import { AgriculturalProductDto, NonAgriculturalProductDto, PackageDetailsDto, UpdatePackageDetailsDto } from 'src/booking/dtos/package.dto';

// Merge existing Package model + partial update into a complete PackageDetailsDto
export function mergeUpdateToPackageDto(existing: Package, updateDto: UpdatePackageDetailsDto): PackageDetailsDto {
  const base = toPackageDetailsDto(existing);
  const merged: PackageDetailsDto = {
    packageType: updateDto.packageType ?? base.packageType,
    productType: updateDto.productType ?? base.productType,
    gstBillUrl: updateDto.gstBillUrl ?? base.gstBillUrl,
    transportDocUrls: updateDto.transportDocUrls ?? base.transportDocUrls,
  };

  if (merged.productType === ProductType.AGRICULTURAL) {
    if(!(updateDto.agricultural instanceof AgriculturalProductDto)) {
      throw new BadRequestException('Agricultural product details required');
    }
    merged.agricultural = {
      productName: updateDto.agricultural.productName,
      approximateWeight: updateDto.agricultural.approximateWeight,
      weightUnit: updateDto.agricultural.weightUnit,
    };
  } else if (merged.productType === ProductType.NON_AGRICULTURAL) {
    if(!(updateDto.nonAgricultural instanceof NonAgriculturalProductDto)) {
      throw new BadRequestException('Non-agricultural product details required');
    }
    merged.nonAgricultural = {
      averageWeight: updateDto.nonAgricultural.averageWeight,
      bundleWeight: updateDto.nonAgricultural.bundleWeight,
      numberOfProducts: updateDto.nonAgricultural.numberOfProducts,
      packageDimensions: updateDto.nonAgricultural.packageDimensions,
      packageDescription: updateDto.nonAgricultural.packageDescription,
      packageImageUrl: updateDto.nonAgricultural.packageImageUrl,
    };
  }

  return merged as PackageDetailsDto;
}

// Convert Package prisma model to PackageDetailsDto (for estimate)
export function toPackageDetailsDto(pkg: Package): PackageDetailsDto {
  const agricultural = pkg.productName
    ? { productName: pkg.productName, approximateWeight: pkg.approximateWeight ?? 0, weightUnit: pkg.weightUnit }
    : undefined;
  const hasNonAg = pkg.averageWeight || pkg.bundleWeight || pkg.numberOfProducts || pkg.description || pkg.packageImageUrl || pkg.length || pkg.width || pkg.height || pkg.dimensionUnit;
  const nonAgricultural = hasNonAg
    ? {
        averageWeight: pkg.averageWeight ?? undefined,
        bundleWeight: pkg.bundleWeight ?? undefined,
        numberOfProducts: pkg.numberOfProducts ?? undefined,
        packageDimensions: pkg.length || pkg.width || pkg.height || pkg.dimensionUnit
          ? { length: pkg.length ?? undefined, width: pkg.width ?? undefined, height: pkg.height ?? undefined, unit: pkg.dimensionUnit ?? undefined }
          : undefined,
        packageDescription: pkg.description ?? undefined,
        packageImageUrl: pkg.packageImageUrl ?? undefined,
      }
    : undefined;
  return {
    packageType: pkg.packageType,
    productType: pkg.productType,
    agricultural,
    nonAgricultural,
    gstBillUrl: pkg.gstBillUrl ?? undefined,
    transportDocUrls: pkg.transportDocUrls ?? undefined,
  } as PackageDetailsDto;
}
// Create flat object for prisma create from full DTO
export function toPackageCreateData(dto: PackageDetailsDto): Prisma.PackageCreateInput {
  return {
    packageType: dto.packageType,
    productType: dto.productType,
    productName: dto.agricultural?.productName ?? null,
    approximateWeight: dto.agricultural?.approximateWeight ?? null,
    weightUnit: dto.agricultural?.weightUnit ?? undefined,
    averageWeight: dto.nonAgricultural?.averageWeight ?? null,
    bundleWeight: dto.nonAgricultural?.bundleWeight ?? null,
    numberOfProducts: dto.nonAgricultural?.numberOfProducts ?? null,
    length: dto.nonAgricultural?.packageDimensions?.length ?? null,
    width: dto.nonAgricultural?.packageDimensions?.width ?? null,
    height: dto.nonAgricultural?.packageDimensions?.height ?? null,
    dimensionUnit: dto.nonAgricultural?.packageDimensions?.unit ?? null,
    description: dto.nonAgricultural?.packageDescription ?? null,
    packageImageUrl: dto.nonAgricultural?.packageImageUrl ?? null,
    gstBillUrl: dto.gstBillUrl ?? null,
    transportDocUrls: dto.transportDocUrls ?? undefined,
  };
}

// Create flat object for prisma update from partial DTO (clears opposite-type fields on switch)
export function toPackageUpdateData(updateDto: UpdatePackageDetailsDto): Prisma.PackageUpdateInput {
  const out: Prisma.PackageUpdateInput = {};
  if (updateDto.packageType !== undefined) out.packageType = updateDto.packageType;
  if (updateDto.productType !== undefined) out.productType = updateDto.productType;
  if (updateDto.agricultural) {
    if (updateDto.agricultural.productName !== undefined) out.productName = updateDto.agricultural.productName;
    if (updateDto.agricultural.approximateWeight !== undefined) out.approximateWeight = updateDto.agricultural.approximateWeight;
    if (updateDto.agricultural.weightUnit !== undefined) out.weightUnit = updateDto.agricultural.weightUnit;
    if (updateDto.productType === ProductType.AGRICULTURAL) {
      out.averageWeight = null;
      out.bundleWeight = null;
      out.numberOfProducts = null;
      out.length = null;
      out.width = null;
      out.height = null;
      out.dimensionUnit = null;
      out.description = null;
      out.packageImageUrl = null;
    }
  }
  if (updateDto.nonAgricultural) {
    const na = updateDto.nonAgricultural;
    if (na.averageWeight !== undefined) out.averageWeight = na.averageWeight;
    if (na.bundleWeight !== undefined) out.bundleWeight = na.bundleWeight;
    if (na.numberOfProducts !== undefined) out.numberOfProducts = na.numberOfProducts;
    if (na.packageDimensions) {
      if (na.packageDimensions.length !== undefined) out.length = na.packageDimensions.length;
      if (na.packageDimensions.width !== undefined) out.width = na.packageDimensions.width;
      if (na.packageDimensions.height !== undefined) out.height = na.packageDimensions.height;
      if (na.packageDimensions.unit !== undefined) out.dimensionUnit = na.packageDimensions.unit;
    }
    if (na.packageDescription !== undefined) out.description = na.packageDescription;
    if (na.packageImageUrl !== undefined) out.packageImageUrl = na.packageImageUrl;
    if (updateDto.productType === ProductType.NON_AGRICULTURAL) {
      out.productName = null;
      out.approximateWeight = null;
    }
  }
  if (updateDto.gstBillUrl !== undefined) out.gstBillUrl = updateDto.gstBillUrl;
  if (updateDto.transportDocUrls !== undefined) out.transportDocUrls = updateDto.transportDocUrls as any;
  return out;
}


