/*
  Warnings:

  - You are about to drop the column `baseFare` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `distanceCharge` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `distanceKm` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `estimatedCost` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `finalCost` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `paymentLinkUrl` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `rzpOrderId` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `rzpPaymentId` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `suggestedVehicleType` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `vehicleMultiplier` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `weightMultiplier` on the `Booking` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."InvoiceType" AS ENUM ('ESTIMATE', 'FINAL');

-- AlterTable
ALTER TABLE "public"."Booking" DROP COLUMN "baseFare",
DROP COLUMN "distanceCharge",
DROP COLUMN "distanceKm",
DROP COLUMN "estimatedCost",
DROP COLUMN "finalCost",
DROP COLUMN "paymentLinkUrl",
DROP COLUMN "rzpOrderId",
DROP COLUMN "rzpPaymentId",
DROP COLUMN "suggestedVehicleType",
DROP COLUMN "vehicleMultiplier",
DROP COLUMN "weightMultiplier",
ADD COLUMN     "cancelledAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "public"."Invoice" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "type" "public"."InvoiceType" NOT NULL,
    "vehicleModelName" TEXT NOT NULL,
    "basePrice" DECIMAL(10,2) NOT NULL,
    "perKmPrice" DECIMAL(10,2) NOT NULL,
    "baseKm" INTEGER NOT NULL,
    "distanceKm" DECIMAL(10,2) NOT NULL,
    "weightInTons" DECIMAL(10,2) NOT NULL,
    "effectiveBasePrice" DECIMAL(10,2) NOT NULL,
    "totalPrice" DECIMAL(10,2) NOT NULL,
    "walletApplied" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "finalAmount" DECIMAL(10,2) NOT NULL,
    "paymentLinkUrl" TEXT,
    "rzpOrderId" TEXT,
    "rzpPaymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_bookingId_type_key" ON "public"."Invoice"("bookingId", "type");

-- AddForeignKey
ALTER TABLE "public"."Invoice" ADD CONSTRAINT "Invoice_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
