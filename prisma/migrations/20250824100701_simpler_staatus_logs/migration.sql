/*
  Warnings:

  - You are about to drop the `BookingLifecycleEvent` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `BookingTracking` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `DriverReview` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."BookingLifecycleEvent" DROP CONSTRAINT "BookingLifecycleEvent_bookingId_fkey";

-- DropForeignKey
ALTER TABLE "public"."BookingTracking" DROP CONSTRAINT "BookingTracking_bookingId_fkey";

-- DropForeignKey
ALTER TABLE "public"."BookingTracking" DROP CONSTRAINT "BookingTracking_driverId_fkey";

-- DropForeignKey
ALTER TABLE "public"."DriverReview" DROP CONSTRAINT "DriverReview_bookingId_fkey";

-- DropForeignKey
ALTER TABLE "public"."DriverReview" DROP CONSTRAINT "DriverReview_driverId_fkey";

-- DropTable
DROP TABLE "public"."BookingLifecycleEvent";

-- DropTable
DROP TABLE "public"."BookingTracking";

-- DropTable
DROP TABLE "public"."DriverReview";

-- CreateTable
CREATE TABLE "public"."BookingStatusLog" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "status" "public"."BookingStatus" NOT NULL,
    "statusChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingStatusLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookingStatusLog_bookingId_status_idx" ON "public"."BookingStatusLog"("bookingId", "status");

-- CreateIndex
CREATE INDEX "BookingStatusLog_statusChangedAt_idx" ON "public"."BookingStatusLog"("statusChangedAt");

-- AddForeignKey
ALTER TABLE "public"."BookingStatusLog" ADD CONSTRAINT "BookingStatusLog_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
