import { PrismaClient, VehicleType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding vehicle models...');

  const vehicleModels = [
    { name: 'Tata Ace', perKm: 50,  baseKm: 4,  baseFare: 400,  maxWeightTons: 2 },
    { name: 'Mahindra Pickup', perKm: 60,  baseKm: 5,  baseFare: 500,  maxWeightTons: 2.5 },
    { name: 'Bolero Camper', perKm: 55,  baseKm: 5,  baseFare: 450,  maxWeightTons: 1.5 },
    { name: 'Tata 407', perKm: 70,  baseKm: 6,  baseFare: 600,  maxWeightTons: 4 },
    { name: 'Eicher 14ft', perKm: 85,  baseKm: 8,  baseFare: 800,  maxWeightTons: 7 },
    { name: 'Eicher 17ft',  perKm: 95,  baseKm: 10, baseFare: 900,  maxWeightTons: 9 },
    { name: 'Tata 22ft LPT',  perKm: 110, baseKm: 12, baseFare: 1200, maxWeightTons: 14 },
    { name: 'Ashok Leyland 19ft',  perKm: 100, baseKm: 10, baseFare: 1000, maxWeightTons: 10 },
    { name: 'Tata 32ft Multi Axle', perKm: 150, baseKm: 15, baseFare: 1800, maxWeightTons: 18 },
    { name: 'Trailer 40ft', perKm: 200, baseKm: 20, baseFare: 2500, maxWeightTons: 25 }
  ];
  

  for (const vm of vehicleModels) {
    await prisma.vehicleModel.upsert({
      where: { name: vm.name },
      update: {},
      create: vm,
    });
  }

  console.log('Vehicle models seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
