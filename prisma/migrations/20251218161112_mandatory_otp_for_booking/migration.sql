/*
  Warnings:

  - The values [TWO_WHEELER] on the enum `VehicleType` will be removed. If these variants are still used in the database, this will fail.
  - Made the column `pickupOtp` on table `Booking` required. This step will fail if there are existing NULL values in that column.
  - Made the column `dropOtp` on table `Booking` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."VehicleType_new" AS ENUM ('THREE_WHEELER', 'FOUR_WHEELER');
ALTER TABLE "public"."Vehicle" ALTER COLUMN "vehicleType" TYPE "public"."VehicleType_new" USING ("vehicleType"::text::"public"."VehicleType_new");
ALTER TYPE "public"."VehicleType" RENAME TO "VehicleType_old";
ALTER TYPE "public"."VehicleType_new" RENAME TO "VehicleType";
DROP TYPE "public"."VehicleType_old";
COMMIT;

-- AlterTable
ALTER TABLE "public"."Booking" ALTER COLUMN "pickupOtp" SET NOT NULL,
ALTER COLUMN "dropOtp" SET NOT NULL;
