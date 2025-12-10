/*
  Warnings:

  - You are about to drop the column `vehicleType` on the `VehicleModel` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."VehicleModel_vehicleType_idx";

-- AlterTable
ALTER TABLE "public"."VehicleModel" DROP COLUMN "vehicleType";
