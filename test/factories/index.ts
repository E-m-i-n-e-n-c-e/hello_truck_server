import { PrismaClient, VerificationStatus, DriverStatus, VehicleType, VehicleBodyType, FuelType } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Create a test customer with unique phone number
 */
export async function createTestCustomer(overrides?: Partial<{
  phoneNumber: string;
  firstName: string;
  email: string;
  walletBalance: number;
}>) {
  const phone = overrides?.phoneNumber || `99${Date.now().toString().slice(-8)}`;
  
  return prisma.customer.create({
    data: {
      phoneNumber: phone,
      firstName: overrides?.firstName || 'Test Customer',
      email: overrides?.email || `test${Date.now()}@example.com`,
      walletBalance: overrides?.walletBalance ?? 0,
    },
  });
}

/**
 * Create a test driver with unique phone number and VERIFIED status
 */
export async function createTestDriver(overrides?: Partial<{
  phoneNumber: string;
  firstName: string;
  verificationStatus: VerificationStatus;
}>) {
  const phone = overrides?.phoneNumber || `88${Date.now().toString().slice(-8)}`;
  
  return prisma.driver.create({
    data: {
      phoneNumber: phone,
      firstName: overrides?.firstName || 'Test Driver',
      verificationStatus: overrides?.verificationStatus || VerificationStatus.VERIFIED,
      driverStatus: DriverStatus.AVAILABLE,
    },
  });
}

/**
 * Create a test vehicle for a driver
 */
export async function createTestVehicle(driverId: string, modelName?: string) {
  const vehicleModelName = modelName || 'Tata Ace';
  
  // Ensure the model exists
  const model = await prisma.vehicleModel.findUnique({
    where: { name: vehicleModelName },
  });

  if (!model) {
    throw new Error(`VehicleModel ${vehicleModelName} not found. Run seedVehicleModels first.`);
  }

  return prisma.vehicle.create({
    data: {
      driverId,
      vehicleNumber: `TS${Date.now().toString().slice(-6)}`,
      vehicleType: VehicleType.FOUR_WHEELER,
      vehicleModelName,
      vehicleBodyLength: 8.5,
      vehicleBodyType: VehicleBodyType.CLOSED,
      fuelType: FuelType.DIESEL,
      vehicleImageUrl: 'https://example.com/vehicle.jpg',
    },
  });
}

/**
 * Create test documents for a driver (all VERIFIED)
 */
export async function createTestDocuments(driverId: string) {
  const futureDate = new Date();
  futureDate.setFullYear(futureDate.getFullYear() + 2);

  return prisma.driverDocuments.create({
    data: {
      driverId,
      licenseUrl: 'https://example.com/license.jpg',
      licenseStatus: VerificationStatus.VERIFIED,
      licenseExpiry: futureDate,
      rcBookUrl: 'https://example.com/rcbook.jpg',
      fcUrl: 'https://example.com/fc.jpg',
      fcStatus: VerificationStatus.VERIFIED,
      fcExpiry: futureDate,
      insuranceUrl: 'https://example.com/insurance.jpg',
      insuranceStatus: VerificationStatus.VERIFIED,
      insuranceExpiry: futureDate,
      aadharUrl: 'https://example.com/aadhar.jpg',
      panNumber: `PAN${Date.now().toString().slice(-6)}`,
      ebBillUrl: 'https://example.com/ebbill.jpg',
    },
  });
}

/**
 * Generate a valid booking request DTO
 */
export function createBookingRequestDto() {
  return {
    pickupAddress: {
      formattedAddress: '123 Pickup St, Hyderabad',
      addressDetails: 'Near landmark',
      latitude: 17.385044,
      longitude: 78.486671,
      contactName: 'John Doe',
      contactPhone: '9876543210',
    },
    dropAddress: {
      formattedAddress: '456 Drop Ave, Hyderabad',
      addressDetails: 'Building 5',
      latitude: 17.445,
      longitude: 78.525,
      contactName: 'Jane Smith',
      contactPhone: '9876543211',
    },
    package: {
      productType: 'PERSONAL',
      approximateWeight: 50,
      weightUnit: 'KG',
      personal: {
        productName: 'Furniture',
      },
    },
  };
}

export { prisma };
