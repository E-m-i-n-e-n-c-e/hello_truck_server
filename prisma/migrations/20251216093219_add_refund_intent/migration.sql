/*
  Warnings:

  - You are about to drop the column `nextRetryAt` on the `RefundIntent` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."RefundIntent" DROP CONSTRAINT "RefundIntent_bookingId_fkey";

-- DropForeignKey
ALTER TABLE "public"."RefundIntent" DROP CONSTRAINT "RefundIntent_customerId_fkey";

-- DropIndex
DROP INDEX "public"."RefundIntent_status_nextRetryAt_idx";

-- AlterTable
ALTER TABLE "public"."RefundIntent" DROP COLUMN "nextRetryAt";

-- CreateIndex
CREATE INDEX "RefundIntent_status_idx" ON "public"."RefundIntent"("status");

-- AddForeignKey
ALTER TABLE "public"."RefundIntent" ADD CONSTRAINT "RefundIntent_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RefundIntent" ADD CONSTRAINT "RefundIntent_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
