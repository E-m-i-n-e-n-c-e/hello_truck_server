/*
  Warnings:

  - You are about to drop the `OtpVerification` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Booking" ADD COLUMN     "dropOtp" TEXT,
ADD COLUMN     "pickupOtp" TEXT;

-- DropTable
DROP TABLE "public"."OtpVerification";
