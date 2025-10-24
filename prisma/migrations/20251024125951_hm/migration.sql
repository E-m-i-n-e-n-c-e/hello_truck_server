/*
  Warnings:

  - A unique constraint covering the columns `[packageId]` on the table `Booking` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Booking_packageId_key" ON "public"."Booking"("packageId");
