/*
  Warnings:

  - You are about to drop the column `addressName` on the `Address` table. All the data in the column will be lost.
  - You are about to drop the column `contactName` on the `Address` table. All the data in the column will be lost.
  - You are about to drop the column `contactPhone` on the `Address` table. All the data in the column will be lost.
  - You are about to drop the column `noteToDriver` on the `Address` table. All the data in the column will be lost.
  - You are about to drop the `CustomerReferral` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `DriverReferral` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[pickupAddressId]` on the table `Booking` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[dropAddressId]` on the table `Booking` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[addressId]` on the table `SavedAddress` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "public"."Booking" DROP CONSTRAINT "Booking_customerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Booking" DROP CONSTRAINT "Booking_dropAddressId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Booking" DROP CONSTRAINT "Booking_pickupAddressId_fkey";

-- DropForeignKey
ALTER TABLE "public"."BookingAssignment" DROP CONSTRAINT "BookingAssignment_bookingId_fkey";

-- DropForeignKey
ALTER TABLE "public"."BookingAssignment" DROP CONSTRAINT "BookingAssignment_driverId_fkey";

-- DropForeignKey
ALTER TABLE "public"."BookingStatusLog" DROP CONSTRAINT "BookingStatusLog_bookingId_fkey";

-- DropForeignKey
ALTER TABLE "public"."CustomerGstDetails" DROP CONSTRAINT "CustomerGstDetails_customerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."CustomerReferral" DROP CONSTRAINT "CustomerReferral_referredById_fkey";

-- DropForeignKey
ALTER TABLE "public"."CustomerReferral" DROP CONSTRAINT "CustomerReferral_referredCustomerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."CustomerSession" DROP CONSTRAINT "CustomerSession_customerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."DriverAddress" DROP CONSTRAINT "DriverAddress_driverId_fkey";

-- DropForeignKey
ALTER TABLE "public"."DriverDocuments" DROP CONSTRAINT "DriverDocuments_driverId_fkey";

-- DropForeignKey
ALTER TABLE "public"."DriverReferral" DROP CONSTRAINT "DriverReferral_referredById_fkey";

-- DropForeignKey
ALTER TABLE "public"."DriverReferral" DROP CONSTRAINT "DriverReferral_referredDriverId_fkey";

-- DropForeignKey
ALTER TABLE "public"."DriverSession" DROP CONSTRAINT "DriverSession_driverId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Vehicle" DROP CONSTRAINT "Vehicle_driverId_fkey";

-- DropForeignKey
ALTER TABLE "public"."VehicleOwner" DROP CONSTRAINT "VehicleOwner_vehicleId_fkey";

-- DropIndex
DROP INDEX "public"."Booking_packageId_idx";

-- DropIndex
DROP INDEX "public"."SavedAddress_addressId_idx";

-- AlterTable
ALTER TABLE "public"."Address" DROP COLUMN "addressName",
DROP COLUMN "contactName",
DROP COLUMN "contactPhone",
DROP COLUMN "noteToDriver";

-- AlterTable
ALTER TABLE "public"."Booking" ADD COLUMN     "acceptedAt" TIMESTAMP(3);

-- DropTable
DROP TABLE "public"."CustomerReferral";

-- DropTable
DROP TABLE "public"."DriverReferral";

-- CreateTable
CREATE TABLE "public"."BookingAddress" (
    "id" TEXT NOT NULL,
    "addressName" TEXT,
    "noteToDriver" TEXT,
    "contactName" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "formattedAddress" TEXT NOT NULL,
    "addressDetails" TEXT,
    "latitude" DECIMAL(10,8) NOT NULL,
    "longitude" DECIMAL(11,8) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingAddress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookingAddress_latitude_longitude_idx" ON "public"."BookingAddress"("latitude", "longitude");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_pickupAddressId_key" ON "public"."Booking"("pickupAddressId");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_dropAddressId_key" ON "public"."Booking"("dropAddressId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedAddress_addressId_key" ON "public"."SavedAddress"("addressId");

-- AddForeignKey
ALTER TABLE "public"."CustomerGstDetails" ADD CONSTRAINT "CustomerGstDetails_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerSession" ADD CONSTRAINT "CustomerSession_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DriverDocuments" ADD CONSTRAINT "DriverDocuments_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DriverSession" ADD CONSTRAINT "DriverSession_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Vehicle" ADD CONSTRAINT "Vehicle_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VehicleOwner" ADD CONSTRAINT "VehicleOwner_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "public"."Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DriverAddress" ADD CONSTRAINT "DriverAddress_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Booking" ADD CONSTRAINT "Booking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Booking" ADD CONSTRAINT "Booking_pickupAddressId_fkey" FOREIGN KEY ("pickupAddressId") REFERENCES "public"."BookingAddress"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Booking" ADD CONSTRAINT "Booking_dropAddressId_fkey" FOREIGN KEY ("dropAddressId") REFERENCES "public"."BookingAddress"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BookingAssignment" ADD CONSTRAINT "BookingAssignment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BookingAssignment" ADD CONSTRAINT "BookingAssignment_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BookingStatusLog" ADD CONSTRAINT "BookingStatusLog_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
