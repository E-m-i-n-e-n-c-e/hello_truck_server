import { IsString, IsNotEmpty, IsEnum, IsOptional, Matches } from 'class-validator';

export enum PayoutMethod {
  BANK_ACCOUNT = 'BANK_ACCOUNT',
  VPA = 'VPA'
}

export class CreateBankDetailsDto {
  @IsString()
  @IsNotEmpty()
  accountHolderName: string;

  @IsString()
  @IsNotEmpty()
  accountNumber: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/, { message: 'Invalid IFSC code' })
  ifscCode: string;
}

export class CreateVpaDetailsDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9\.\-_]{2,256}@[a-zA-Z0-9\.\-_]{2,64}$/i, { message: 'Invalid VPA' })
  vpa: string;
}

export class CreatePayoutDetailsDto {
  @IsEnum(PayoutMethod)
  payoutMethod: PayoutMethod;

  @IsOptional()
  bankDetails?: CreateBankDetailsDto;

  @IsOptional()
  vpaDetails?: CreateVpaDetailsDto;
}