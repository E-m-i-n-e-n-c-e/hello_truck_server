/*
  Warnings:

  - A unique constraint covering the columns `[bookingNumber]` on the table `Booking` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."Booking" ADD COLUMN     "bookingNumber" BIGSERIAL NOT NULL,
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "dropArrivedAt" TIMESTAMP(3),
ADD COLUMN     "dropVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "paymentLinkUrl" TEXT,
ADD COLUMN     "payment_id" TEXT,
ADD COLUMN     "pickupArrivedAt" TIMESTAMP(3),
ADD COLUMN     "pickupVerifiedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Booking_bookingNumber_key" ON "public"."Booking"("bookingNumber");
