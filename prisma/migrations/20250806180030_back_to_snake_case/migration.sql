/*
  Warnings:

  - The values [diesel,petrol,ev,cng] on the enum `FuelType` will be removed. If these variants are still used in the database, this will fail.
  - The values [open,closed] on the enum `VehicleBodyType` will be removed. If these variants are still used in the database, this will fail.
  - The values [threeWheeler,fourWheeler] on the enum `VehicleType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "FuelType_new" AS ENUM ('DIESEL', 'PETROL', 'EV', 'CNG');
ALTER TABLE "Vehicle" ALTER COLUMN "fuelType" TYPE "FuelType_new" USING ("fuelType"::text::"FuelType_new");
ALTER TYPE "FuelType" RENAME TO "FuelType_old";
ALTER TYPE "FuelType_new" RENAME TO "FuelType";
DROP TYPE "FuelType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "VehicleBodyType_new" AS ENUM ('OPEN', 'CLOSED');
ALTER TABLE "Vehicle" ALTER COLUMN "vehicleBodyType" TYPE "VehicleBodyType_new" USING ("vehicleBodyType"::text::"VehicleBodyType_new");
ALTER TYPE "VehicleBodyType" RENAME TO "VehicleBodyType_old";
ALTER TYPE "VehicleBodyType_new" RENAME TO "VehicleBodyType";
DROP TYPE "VehicleBodyType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "VehicleType_new" AS ENUM ('THREE_WHEELER', 'FOUR_WHEELER');
ALTER TABLE "Vehicle" ALTER COLUMN "vehicleType" TYPE "VehicleType_new" USING ("vehicleType"::text::"VehicleType_new");
ALTER TYPE "VehicleType" RENAME TO "VehicleType_old";
ALTER TYPE "VehicleType_new" RENAME TO "VehicleType";
DROP TYPE "VehicleType_old";
COMMIT;
