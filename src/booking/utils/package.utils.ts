import { BadRequestException } from '@nestjs/common';
import { Package, Prisma, ProductType } from '@prisma/client';
import { AgriculturalProductDto, NonAgriculturalProductDto, PackageDetailsDto, PersonalProductDto, UpdatePackageDetailsDto } from 'src/booking/dtos/package.dto';

// Merge existing Package model + partial update into a complete PackageDetailsDto
export function mergeUpdateToPackageDto(existing: Package, updateDto: UpdatePackageDetailsDto): PackageDetailsDto {
  const base = toPackageDetailsDto(existing);
  const merged: PackageDetailsDto = {
    productType: updateDto.productType ?? base.productType,
    approximateWeight: updateDto.approximateWeight ?? base.approximateWeight,
    weightUnit: updateDto.weightUnit ?? base.weightUnit,
    packageImageUrl: updateDto.packageImageUrl ?? base.packageImageUrl,
    transportDocUrls: updateDto.transportDocUrls ?? base.transportDocUrls,
  };

  // Handle PERSONAL product type
  if (merged.productType === ProductType.PERSONAL) {
    if (!(updateDto.personal instanceof PersonalProductDto)) {
      throw new BadRequestException('Personal product details required');
    }
    merged.personal = {
      productName: updateDto.personal.productName,
    };
    return merged as PackageDetailsDto;
  }

  // Handle AGRICULTURAL product type (commercial)
  if (merged.productType === ProductType.AGRICULTURAL) {
    if (!(updateDto.agricultural instanceof AgriculturalProductDto)) {
      throw new BadRequestException('Agricultural product details required');
    }
    merged.agricultural = {
      productName: updateDto.agricultural.productName,
      gstBillUrl: updateDto.agricultural.gstBillUrl,
    };
  } else if (merged.productType === ProductType.NON_AGRICULTURAL) {
    // Handle NON_AGRICULTURAL product type (commercial)
    if (!(updateDto.nonAgricultural instanceof NonAgriculturalProductDto)) {
      throw new BadRequestException('Non-agricultural product details required');
    }
    merged.nonAgricultural = {
      bundleWeight: updateDto.nonAgricultural.bundleWeight,
      numberOfProducts: updateDto.nonAgricultural.numberOfProducts,
      packageDimensions: updateDto.nonAgricultural.packageDimensions,
      packageDescription: updateDto.nonAgricultural.packageDescription,
      gstBillUrl: updateDto.nonAgricultural.gstBillUrl,
    };
  }

  return merged as PackageDetailsDto;
}

// Convert Package prisma model to PackageDetailsDto (for estimate)
export function toPackageDetailsDto(pkg: Package): PackageDetailsDto {
  // Handle PERSONAL product type
  if (pkg.productType === ProductType.PERSONAL) {
    if(!pkg.productName) throw new BadRequestException('Personal product details required');
    const personal : PersonalProductDto = { productName: pkg.productName }
    
    return {
      productType: pkg.productType,
      approximateWeight: Number(pkg.approximateWeight),
      weightUnit: pkg.weightUnit,
      personal,
      packageImageUrl: pkg.packageImageUrl,
      transportDocUrls: pkg.transportDocUrls,
    } as PackageDetailsDto;
  }

  // Handle AGRICULTURAL product type (commercial)
  if (pkg.productType === ProductType.AGRICULTURAL) {
    if(!pkg.productName) throw new BadRequestException('Agricultural product details required');
    const agricultural : AgriculturalProductDto = { 
          productName: pkg.productName,
          gstBillUrl: pkg.gstBillUrl ?? undefined
        }
    
    return {
      productType: pkg.productType,
      approximateWeight: Number(pkg.approximateWeight),
      weightUnit: pkg.weightUnit,
      agricultural,
      packageImageUrl: pkg.packageImageUrl,
      transportDocUrls: pkg.transportDocUrls,
    } as PackageDetailsDto;
  }

  // Handle NON_AGRICULTURAL product type (commercial)
  if(!pkg.gstBillUrl || !pkg.bundleWeight) throw new BadRequestException('Non-agricultural product details required');
  const nonAgricultural : NonAgriculturalProductDto = {
        bundleWeight: Number(pkg.bundleWeight),
        numberOfProducts: pkg.numberOfProducts ? Number(pkg.numberOfProducts) : undefined,
        packageDimensions: pkg.length && pkg.width && pkg.height && pkg.dimensionUnit
          ? { length: Number(pkg.length), width: Number(pkg.width), height: Number(pkg.height), unit: pkg.dimensionUnit }
          : undefined,
        packageDescription: pkg.description ?? undefined,
        gstBillUrl: pkg.gstBillUrl,
      }
  
  return {
    productType: pkg.productType,
    approximateWeight: Number(pkg.approximateWeight),
    weightUnit: pkg.weightUnit,
    nonAgricultural,
    packageImageUrl: pkg.packageImageUrl,
    transportDocUrls: pkg.transportDocUrls,
  } as PackageDetailsDto;
}

// Create flat object for prisma create from full DTO
export function toPackageCreateData(dto: PackageDetailsDto): Prisma.PackageCreateInput {
  return {
    productType: dto.productType,
    productName:
      dto.productType === ProductType.PERSONAL
        ? dto.personal?.productName
        : dto.productType === ProductType.AGRICULTURAL
          ? dto.agricultural?.productName
          : null,
    approximateWeight: dto.approximateWeight,
    weightUnit: dto.weightUnit,
    bundleWeight: dto.nonAgricultural?.bundleWeight ?? null,
    numberOfProducts: dto.nonAgricultural?.numberOfProducts ?? null,
    length: dto.nonAgricultural?.packageDimensions?.length ?? null,
    width: dto.nonAgricultural?.packageDimensions?.width ?? null,
    height: dto.nonAgricultural?.packageDimensions?.height ?? null,
    dimensionUnit: dto.nonAgricultural?.packageDimensions?.unit ?? null,
    description: dto.nonAgricultural?.packageDescription ?? null,
    packageImageUrl: dto.packageImageUrl ?? null,
    gstBillUrl:
      dto.productType === ProductType.AGRICULTURAL
        ? dto.agricultural?.gstBillUrl
        : dto.productType === ProductType.NON_AGRICULTURAL
          ? dto.nonAgricultural?.gstBillUrl
          : null,
    transportDocUrls: dto.transportDocUrls ?? undefined,
  };
}

// Create flat object for prisma update from partial DTO (clears opposite-type fields on switch)
export function toPackageUpdateData(updateDto: UpdatePackageDetailsDto): Prisma.PackageUpdateInput {
  const out: Prisma.PackageUpdateInput = {};
  
  if (updateDto.productType !== undefined) out.productType = updateDto.productType;
  
  // Handle PERSONAL product type
  if (updateDto.productType === ProductType.PERSONAL) {
    if (updateDto.personal) {
      if (updateDto.personal.productName !== undefined) out.productName = updateDto.personal.productName;
    }
    
    // Clear all commercial fields
    out.bundleWeight = null;
    out.numberOfProducts = null;
    out.length = null;
    out.width = null;
    out.height = null;
    out.dimensionUnit = null;
    out.description = null;
    out.gstBillUrl = null;
    
    if (updateDto.approximateWeight !== undefined) out.approximateWeight = updateDto.approximateWeight;
    if (updateDto.weightUnit !== undefined) out.weightUnit = updateDto.weightUnit;
    if (updateDto.packageImageUrl !== undefined) out.packageImageUrl = updateDto.packageImageUrl;
    if (updateDto.transportDocUrls !== undefined) out.transportDocUrls = updateDto.transportDocUrls;
    
    return out;
  }

  // Handle AGRICULTURAL product type (commercial)
  if (updateDto.agricultural) {
    if (updateDto.agricultural.productName !== undefined) out.productName = updateDto.agricultural.productName;
    if (updateDto.agricultural.gstBillUrl !== undefined) out.gstBillUrl = updateDto.agricultural.gstBillUrl;
    
    if (updateDto.productType === ProductType.AGRICULTURAL) {
      // Clear non-agricultural fields
      out.bundleWeight = null;
      out.numberOfProducts = null;
      out.length = null;
      out.width = null;
      out.height = null;
      out.dimensionUnit = null;
      out.description = null;
    }
  }
  
  // Handle NON_AGRICULTURAL product type (commercial)
  if (updateDto.nonAgricultural) {
    const na = updateDto.nonAgricultural;
    if (na.bundleWeight !== undefined) out.bundleWeight = na.bundleWeight;
    if (na.numberOfProducts !== undefined) out.numberOfProducts = na.numberOfProducts;
    if (na.packageDimensions) {
      if (na.packageDimensions.length !== undefined) out.length = na.packageDimensions.length;
      if (na.packageDimensions.width !== undefined) out.width = na.packageDimensions.width;
      if (na.packageDimensions.height !== undefined) out.height = na.packageDimensions.height;
      if (na.packageDimensions.unit !== undefined) out.dimensionUnit = na.packageDimensions.unit;
    }
    if (na.packageDescription !== undefined) out.description = na.packageDescription;
    if (na.gstBillUrl !== undefined) out.gstBillUrl = na.gstBillUrl;
    
    if (updateDto.productType === ProductType.NON_AGRICULTURAL) {
      // Clear agricultural fields
      out.productName = null;
    }
  }
  
  if (updateDto.approximateWeight !== undefined) out.approximateWeight = updateDto.approximateWeight;
  if (updateDto.weightUnit !== undefined) out.weightUnit = updateDto.weightUnit;
  if (updateDto.packageImageUrl !== undefined) out.packageImageUrl = updateDto.packageImageUrl;
  if (updateDto.transportDocUrls !== undefined) out.transportDocUrls = updateDto.transportDocUrls;
  return out;
}
