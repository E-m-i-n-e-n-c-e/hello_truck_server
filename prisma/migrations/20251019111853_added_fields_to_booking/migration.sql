/*
  Warnings:

  - You are about to drop the column `payment_id` on the `Booking` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Booking" DROP COLUMN "payment_id",
ADD COLUMN     "rzpOrderId" TEXT,
ADD COLUMN     "rzpPaymentId" TEXT;
