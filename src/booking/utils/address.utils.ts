import { Address, Prisma } from '@prisma/client';
import { CreateBookingAddressDto, UpdateBookingAddressDto } from 'src/booking/dtos/booking-address.dto';


// Merge existing Address model + partial update into a complete CreateBookingAddressDto
export function mergeAddressUpdateToDto(existing: Address, updateDto: UpdateBookingAddressDto): CreateBookingAddressDto {
  return {
    addressName: updateDto.addressName ?? existing.addressName ?? undefined,
    contactName: updateDto.contactName ?? existing.contactName ?? undefined,
    contactPhone: updateDto.contactPhone ?? existing.contactPhone ?? undefined,
    noteToDriver: updateDto.noteToDriver ?? existing.noteToDriver ?? undefined,
    latitude: updateDto.latitude ?? Number(existing.latitude),
    longitude: updateDto.longitude ?? Number(existing.longitude),
    formattedAddress: updateDto.formattedAddress ?? existing.formattedAddress,
    addressDetails: updateDto.addressDetails ?? existing.addressDetails ?? undefined,
  };
}

// Convert Address prisma model to CreateBookingAddressDto format
export function toBookingAddressDto(address: Address): CreateBookingAddressDto {
  return {
    addressName: address.addressName ?? undefined,
    contactName: address.contactName ?? undefined,
    contactPhone: address.contactPhone ?? undefined,
    noteToDriver: address.noteToDriver ?? undefined,
    latitude: Number(address.latitude),
    longitude: Number(address.longitude),
    formattedAddress: address.formattedAddress,
    addressDetails: address.addressDetails ?? undefined,
  };
}

// Create flat object for prisma create from full DTO
export function toAddressCreateData(dto: CreateBookingAddressDto): Prisma.AddressCreateInput {
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
export function toAddressUpdateData(updateDto: UpdateBookingAddressDto): Prisma.AddressUpdateInput {
  const updateData: Prisma.AddressUpdateInput = {};
  
  if (updateDto.addressName !== undefined) updateData.addressName = updateDto.addressName;
  if (updateDto.contactName !== undefined) updateData.contactName = updateDto.contactName;
  if (updateDto.contactPhone !== undefined) updateData.contactPhone = updateDto.contactPhone;
  if (updateDto.noteToDriver !== undefined) updateData.noteToDriver = updateDto.noteToDriver;
  if (updateDto.latitude !== undefined) updateData.latitude = updateDto.latitude;
  if (updateDto.longitude !== undefined) updateData.longitude = updateDto.longitude;
  if (updateDto.formattedAddress !== undefined) updateData.formattedAddress = updateDto.formattedAddress;
  if (updateDto.addressDetails !== undefined) updateData.addressDetails = updateDto.addressDetails;
  
  return updateData;
}

// Convert address to estimate format (minimal data needed for distance calculation)
export function toAddressForEstimate(address: Address) {
  return {
    latitude: Number(address.latitude),
    longitude: Number(address.longitude),
    formattedAddress: address.formattedAddress,
    addressDetails: address.addressDetails ?? undefined,
  };
}
