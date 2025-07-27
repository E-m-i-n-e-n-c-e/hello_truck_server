import { CustomerGstDetails } from '@prisma/client';
import { Expose } from 'class-transformer';
import { IsString, IsNotEmpty, Matches, IsOptional } from 'class-validator';

export class CreateGstDetailsDto implements Partial<CustomerGstDetails> {
  @IsNotEmpty()
  @IsString()
  @Matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, {
    message: 'Invalid GST number format',
  })
  gstNumber: string;

  @IsNotEmpty()
  @IsString()
  businessName: string;

  @IsNotEmpty()
  @IsString()
  businessAddress: string;
}

export class UpdateGstDetailsDto implements Partial<CustomerGstDetails> {
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, {
    message: 'Invalid GST number format',
  })
  gstNumber?: string;

  @IsOptional()
  @IsString()
  businessName?: string;

  @IsOptional()
  @IsString()
  businessAddress?: string;
}

export class DeactivateGstDetailsDto {
  @IsNotEmpty()
  @IsString()
  id: string;
}

export class ReactivateGstDetailsDto {
  @IsNotEmpty()
  @IsString()
  @Matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, {
    message: 'Invalid GST number format',
  })
  gstNumber: string;
}

export class GstDetailsResponseDto implements CustomerGstDetails {
  customerId: string;
  isActive: boolean;

  @Expose()
  id: string;
  @Expose()
  gstNumber: string;
  @Expose()
  businessName: string;
  @Expose()
  businessAddress: string;
  @Expose()
  createdAt: Date;
  @Expose()
  updatedAt: Date;
}
