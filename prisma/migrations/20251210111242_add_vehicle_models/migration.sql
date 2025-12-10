/*
  Warnings:

  - Added the required column `vehicleModelName` to the `Vehicle` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Vehicle" ADD COLUMN     "vehicleModelName" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "public"."VehicleModel" (
    "name" TEXT NOT NULL,
    "vehicleType" "public"."VehicleType" NOT NULL,
    "perKm" DECIMAL(10,2) NOT NULL,
    "baseKm" INTEGER NOT NULL,
    "baseFare" DECIMAL(10,2) NOT NULL,
    "maxWeightTons" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "VehicleModel_pkey" PRIMARY KEY ("name")
);

-- CreateIndex
CREATE INDEX "VehicleModel_vehicleType_idx" ON "public"."VehicleModel"("vehicleType");

-- CreateIndex
CREATE INDEX "Vehicle_vehicleModelName_idx" ON "public"."Vehicle"("vehicleModelName");

-- CreateIndex
CREATE INDEX "Vehicle_vehicleType_idx" ON "public"."Vehicle"("vehicleType");

-- AddForeignKey
ALTER TABLE "public"."Vehicle" ADD CONSTRAINT "Vehicle_vehicleModelName_fkey" FOREIGN KEY ("vehicleModelName") REFERENCES "public"."VehicleModel"("name") ON DELETE RESTRICT ON UPDATE CASCADE;
