-- CreateEnum
CREATE TYPE "public"."BookingType" AS ENUM ('PERSONAL', 'COMMERCIAL');

-- CreateEnum
CREATE TYPE "public"."ProductType" AS ENUM ('AGRICULTURAL', 'NON_AGRICULTURAL');

-- CreateEnum
CREATE TYPE "public"."WeightUnit" AS ENUM ('KG', 'QUINTAL');

-- CreateEnum
CREATE TYPE "public"."BookingStatus" AS ENUM ('PENDING', 'DRIVER_ASSIGNED', 'CONFIRMED', 'PICKUP_ARRIVED', 'PICKUP_VERIFIED', 'IN_TRANSIT', 'DROP_ARRIVED', 'DROP_VERIFIED', 'COMPLETED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "public"."AssignmentStatus" AS ENUM ('OFFERED', 'ACCEPTED', 'REJECTED', 'AUTO_REJECTED');

-- AlterEnum
ALTER TYPE "public"."VehicleType" ADD VALUE 'TWO_WHEELER';

-- AlterTable
ALTER TABLE "public"."Address" ADD COLUMN     "contactName" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "noteToDriver" TEXT;

-- CreateTable
CREATE TABLE "public"."Booking" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "pickupAddressId" TEXT NOT NULL,
    "dropAddressId" TEXT NOT NULL,
    "bookingType" "public"."BookingType" NOT NULL,
    "productType" "public"."ProductType" NOT NULL,
    "productName" TEXT,
    "approximateWeight" DECIMAL(10,2),
    "weightUnit" "public"."WeightUnit" NOT NULL DEFAULT 'KG',
    "averageWeight" DECIMAL(10,2),
    "bundleWeight" DECIMAL(10,2),
    "numberOfProducts" INTEGER,
    "packageDimensions" JSONB,
    "packageDescription" TEXT,
    "packageImageUrls" TEXT[],
    "gstBillUrl" TEXT,
    "transportDocUrls" TEXT[],
    "estimatedCost" DECIMAL(10,2) NOT NULL,
    "finalCost" DECIMAL(10,2),
    "distanceKm" DECIMAL(10,2) NOT NULL,
    "baseFare" DECIMAL(10,2) NOT NULL,
    "distanceCharge" DECIMAL(10,2) NOT NULL,
    "weightMultiplier" DECIMAL(3,2) NOT NULL DEFAULT 1.0,
    "vehicleMultiplier" DECIMAL(3,2) NOT NULL DEFAULT 1.0,
    "suggestedVehicleType" "public"."VehicleType" NOT NULL,
    "status" "public"."BookingStatus" NOT NULL DEFAULT 'PENDING',
    "assignedDriverId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "scheduledAt" TIMESTAMP(3),

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BookingAssignment" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "status" "public"."AssignmentStatus" NOT NULL DEFAULT 'OFFERED',
    "offeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "BookingAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Booking_customerId_status_idx" ON "public"."Booking"("customerId", "status");

-- CreateIndex
CREATE INDEX "Booking_assignedDriverId_status_idx" ON "public"."Booking"("assignedDriverId", "status");

-- CreateIndex
CREATE INDEX "Booking_status_createdAt_idx" ON "public"."Booking"("status", "createdAt");

-- CreateIndex
CREATE INDEX "BookingAssignment_bookingId_status_idx" ON "public"."BookingAssignment"("bookingId", "status");

-- CreateIndex
CREATE INDEX "BookingAssignment_driverId_status_idx" ON "public"."BookingAssignment"("driverId", "status");

-- CreateIndex
CREATE INDEX "BookingAssignment_status_offeredAt_idx" ON "public"."BookingAssignment"("status", "offeredAt");

-- CreateIndex
CREATE UNIQUE INDEX "BookingAssignment_bookingId_driverId_key" ON "public"."BookingAssignment"("bookingId", "driverId");

-- AddForeignKey
ALTER TABLE "public"."Booking" ADD CONSTRAINT "Booking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Booking" ADD CONSTRAINT "Booking_pickupAddressId_fkey" FOREIGN KEY ("pickupAddressId") REFERENCES "public"."Address"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Booking" ADD CONSTRAINT "Booking_dropAddressId_fkey" FOREIGN KEY ("dropAddressId") REFERENCES "public"."Address"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Booking" ADD CONSTRAINT "Booking_assignedDriverId_fkey" FOREIGN KEY ("assignedDriverId") REFERENCES "public"."Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BookingAssignment" ADD CONSTRAINT "BookingAssignment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BookingAssignment" ADD CONSTRAINT "BookingAssignment_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
