import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Truncate all tables in test database
 */
export async function truncateDatabase(): Promise<void> {
  // Tables in reverse dependency order (children first, parents last)
  const tables = [
    // Logs and webhooks
    'WebhookLog',
    'CustomerWalletLog',
    'DriverWalletLog',
    'DriverStatusLog',
    'BookingStatusLog',
    // Financial
    'Transaction',
    'Payout',
    'Invoice',
    // Booking related
    'BookingAddress',
    'Package',
    'BookingAssignment',
    'Booking',
    // Customer addresses and GST
    'SavedAddress',
    'Address',
    'CustomerGstDetails',
    // Driver related
    'DriverDocuments',
    'VehicleOwner',
    'Vehicle',
    'DriverAddress',
    // Sessions
    'CustomerSession',
    'DriverSession',
    // Parent entities (last)
    'Customer',
    'Driver',
    // Don't truncate VehicleModel - we seed it
  ];

  for (const table of tables) {
    try {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE`);
    } catch (error) {
      // Ignore - table might not exist in this schema version
    }
  }
}

/**
 * Seed VehicleModel data (required for estimates)
 */
export async function seedVehicleModels(): Promise<void> {
  const models = [
    {
      name: 'Tata Ace',
      baseFare: 200,
      perKm: 10,
      baseKm: 5,
      maxWeightTons: 0.75,
    },
    {
      name: 'Mahindra Bolero Pickup',
      baseFare: 300,
      perKm: 12,
      baseKm: 5,
      maxWeightTons: 1.5,
    },
    {
      name: 'Tata 407',
      baseFare: 500,
      perKm: 15,
      baseKm: 5,
      maxWeightTons: 2.5,
    },
  ];

  for (const model of models) {
    await prisma.vehicleModel.upsert({
      where: { name: model.name },
      update: {},
      create: model,
    });
  }
}

/**
 * Setup test database: truncate and seed
 */
export async function setupTestDatabase(): Promise<void> {
  await truncateDatabase();
  await seedVehicleModels();
}

/**
 * Close prisma connection
 */
export async function closeDatabaseConnection(): Promise<void> {
  await prisma.$disconnect();
}

export { prisma };
