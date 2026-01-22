import { BadRequestException } from '@nestjs/common';
import { BookingAddress, Prisma } from '@prisma/client';
import {
  CreateBookingAddressDto,
  UpdateBookingAddressDto,
} from 'src/booking/dtos/booking-address.dto';

// Merge existing Address model + partial update into a complete CreateBookingAddressDto
export function mergeAddressUpdateToDto(
  existing: BookingAddress,
  updateDto: UpdateBookingAddressDto,
): CreateBookingAddressDto {
  if (!existing.contactName || !existing.contactPhone) {
    throw new BadRequestException('Contact name and phone are required');
  }
  return {
    addressName: updateDto.addressName ?? existing.addressName ?? undefined,
    contactName: updateDto.contactName ?? existing.contactName,
    contactPhone: updateDto.contactPhone ?? existing.contactPhone,
    noteToDriver: updateDto.noteToDriver ?? existing.noteToDriver ?? undefined,
    latitude: updateDto.latitude ?? Number(existing.latitude),
    longitude: updateDto.longitude ?? Number(existing.longitude),
    formattedAddress: updateDto.formattedAddress ?? existing.formattedAddress,
    addressDetails:
      updateDto.addressDetails ?? existing.addressDetails ?? undefined,
  };
}

// Convert Address prisma model to CreateBookingAddressDto format
export function toBookingAddressDto(
  address: BookingAddress,
): CreateBookingAddressDto {
  if (!address.contactName || !address.contactPhone) {
    throw new BadRequestException('Contact name and phone are required');
  }
  return {
    addressName: address.addressName ?? undefined,
    contactName: address.contactName,
    contactPhone: address.contactPhone,
    noteToDriver: address.noteToDriver ?? undefined,
    latitude: Number(address.latitude),
    longitude: Number(address.longitude),
    formattedAddress: address.formattedAddress,
    addressDetails: address.addressDetails ?? undefined,
  };
}

// Create flat object for prisma create from full DTO
export function toAddressCreateData(
  dto: CreateBookingAddressDto,
): Prisma.BookingAddressCreateInput {
  return {
    addressName: dto.addressName,
    contactName: dto.contactName,
    contactPhone: dto.contactPhone,
    noteToDriver: dto.noteToDriver ?? null,
    latitude: dto.latitude,
    longitude: dto.longitude,
    formattedAddress: dto.formattedAddress,
    addressDetails: dto.addressDetails ?? null,
  };
}

// Create flat object for prisma update from partial DTO
export function toAddressUpdateData(
  updateDto: UpdateBookingAddressDto,
): Prisma.BookingAddressUpdateInput {
  const updateData: Prisma.BookingAddressUpdateInput = {};

  if (updateDto.addressName !== undefined)
    updateData.addressName = updateDto.addressName;
  if (updateDto.contactName !== undefined)
    updateData.contactName = updateDto.contactName;
  if (updateDto.contactPhone !== undefined)
    updateData.contactPhone = updateDto.contactPhone;
  if (updateDto.noteToDriver !== undefined)
    updateData.noteToDriver = updateDto.noteToDriver;
  if (updateDto.latitude !== undefined)
    updateData.latitude = updateDto.latitude;
  if (updateDto.longitude !== undefined)
    updateData.longitude = updateDto.longitude;
  if (updateDto.formattedAddress !== undefined)
    updateData.formattedAddress = updateDto.formattedAddress;
  if (updateDto.addressDetails !== undefined)
    updateData.addressDetails = updateDto.addressDetails;

  return updateData;
}
