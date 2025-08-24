/*
  Warnings:

  - The values [ONLINE,OFFLINE] on the enum `DriverStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "public"."LifecycleEventType" AS ENUM ('PICKUP_OTP_VERIFIED', 'LOADING_DONE', 'UNLOADING_DONE', 'RIDE_STARTED', 'RIDE_COMPLETED');

-- CreateEnum
CREATE TYPE "public"."ActorType" AS ENUM ('DRIVER', 'CUSTOMER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "public"."ReferralStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- AlterEnum
BEGIN;
CREATE TYPE "public"."DriverStatus_new" AS ENUM ('AVAILABLE', 'UNAVAILABLE', 'ON_RIDE', 'RIDE_OFFERED');
ALTER TABLE "public"."Driver" ALTER COLUMN "driverStatus" DROP DEFAULT;
ALTER TABLE "public"."Driver" ALTER COLUMN "driverStatus" TYPE "public"."DriverStatus_new" USING ("driverStatus"::text::"public"."DriverStatus_new");
ALTER TABLE "public"."DriverStatusLog" ALTER COLUMN "status" TYPE "public"."DriverStatus_new" USING ("status"::text::"public"."DriverStatus_new");
ALTER TYPE "public"."DriverStatus" RENAME TO "DriverStatus_old";
ALTER TYPE "public"."DriverStatus_new" RENAME TO "DriverStatus";
DROP TYPE "public"."DriverStatus_old";
ALTER TABLE "public"."Driver" ALTER COLUMN "driverStatus" SET DEFAULT 'UNAVAILABLE';
COMMIT;

-- AlterTable
ALTER TABLE "public"."Driver" ADD COLUMN     "isOnline" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "driverStatus" SET DEFAULT 'UNAVAILABLE';

-- CreateTable
CREATE TABLE "public"."CustomerReferral" (
    "id" TEXT NOT NULL,
    "referredById" TEXT NOT NULL,
    "referredCustomerId" TEXT NOT NULL,
    "referralCodeUsed" TEXT NOT NULL,
    "referralStatus" "public"."ReferralStatus" NOT NULL DEFAULT 'PENDING',
    "rewardAmount" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerReferral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DriverReferral" (
    "id" TEXT NOT NULL,
    "referredById" TEXT NOT NULL,
    "referredDriverId" TEXT NOT NULL,
    "referralCodeUsed" TEXT NOT NULL,
    "referralStatus" "public"."ReferralStatus" NOT NULL DEFAULT 'PENDING',
    "rewardAmount" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriverReferral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DriverReview" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "review" TEXT,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriverReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BookingLifecycleEvent" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "eventType" "public"."LifecycleEventType" NOT NULL,
    "actorType" "public"."ActorType" NOT NULL,
    "actorId" TEXT,
    "photoUrl" TEXT,
    "notes" TEXT,
    "eventTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingLifecycleEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BookingTracking" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "driverId" TEXT,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingTracking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerReferral_referralStatus_idx" ON "public"."CustomerReferral"("referralStatus");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerReferral_referredById_referredCustomerId_key" ON "public"."CustomerReferral"("referredById", "referredCustomerId");

-- CreateIndex
CREATE INDEX "DriverReferral_referralStatus_idx" ON "public"."DriverReferral"("referralStatus");

-- CreateIndex
CREATE UNIQUE INDEX "DriverReferral_referredById_referredDriverId_key" ON "public"."DriverReferral"("referredById", "referredDriverId");

-- CreateIndex
CREATE INDEX "DriverReview_driverId_idx" ON "public"."DriverReview"("driverId");

-- CreateIndex
CREATE INDEX "DriverReview_rating_idx" ON "public"."DriverReview"("rating");

-- CreateIndex
CREATE INDEX "DriverReview_bookingId_idx" ON "public"."DriverReview"("bookingId");

-- CreateIndex
CREATE INDEX "BookingLifecycleEvent_bookingId_eventType_idx" ON "public"."BookingLifecycleEvent"("bookingId", "eventType");

-- CreateIndex
CREATE INDEX "BookingLifecycleEvent_eventTime_idx" ON "public"."BookingLifecycleEvent"("eventTime");

-- CreateIndex
CREATE INDEX "BookingTracking_bookingId_idx" ON "public"."BookingTracking"("bookingId");

-- CreateIndex
CREATE INDEX "BookingTracking_driverId_idx" ON "public"."BookingTracking"("driverId");

-- CreateIndex
CREATE INDEX "BookingTracking_recordedAt_idx" ON "public"."BookingTracking"("recordedAt");

-- CreateIndex
CREATE INDEX "Booking_packageId_idx" ON "public"."Booking"("packageId");

-- CreateIndex
CREATE INDEX "Driver_isOnline_driverStatus_idx" ON "public"."Driver"("isOnline", "driverStatus");

-- CreateIndex
CREATE INDEX "OtpVerification_phoneNumber_verified_idx" ON "public"."OtpVerification"("phoneNumber", "verified");

-- AddForeignKey
ALTER TABLE "public"."CustomerReferral" ADD CONSTRAINT "CustomerReferral_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "public"."Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerReferral" ADD CONSTRAINT "CustomerReferral_referredCustomerId_fkey" FOREIGN KEY ("referredCustomerId") REFERENCES "public"."Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DriverReferral" ADD CONSTRAINT "DriverReferral_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "public"."Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DriverReferral" ADD CONSTRAINT "DriverReferral_referredDriverId_fkey" FOREIGN KEY ("referredDriverId") REFERENCES "public"."Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DriverReview" ADD CONSTRAINT "DriverReview_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DriverReview" ADD CONSTRAINT "DriverReview_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BookingLifecycleEvent" ADD CONSTRAINT "BookingLifecycleEvent_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BookingTracking" ADD CONSTRAINT "BookingTracking_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BookingTracking" ADD CONSTRAINT "BookingTracking_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;
