/*
  Warnings:

  - The values [INITIATED] on the enum `AdminRefundStatus` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[refundIntentId]` on the table `AdminRefundRequest` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."AdminRefundStatus_new" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REVERT_REQUESTED', 'REVERTED', 'COMPLETED');
ALTER TABLE "public"."AdminRefundRequest" ALTER COLUMN "status" TYPE "public"."AdminRefundStatus_new" USING ("status"::text::"public"."AdminRefundStatus_new");
ALTER TYPE "public"."AdminRefundStatus" RENAME TO "AdminRefundStatus_old";
ALTER TYPE "public"."AdminRefundStatus_new" RENAME TO "AdminRefundStatus";
DROP TYPE "public"."AdminRefundStatus_old";
COMMIT;

-- DropIndex
DROP INDEX "public"."AdminRefundRequest_bookingId_key";

-- DropIndex
DROP INDEX "public"."RefundIntent_bookingId_key";

-- AlterTable
ALTER TABLE "public"."AdminRefundRequest" ADD COLUMN     "cancellationCharge" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "rejectionReason" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "AdminRefundRequest_refundIntentId_key" ON "public"."AdminRefundRequest"("refundIntentId");

-- CreateIndex
CREATE INDEX "AdminRefundRequest_bookingId_idx" ON "public"."AdminRefundRequest"("bookingId");

-- CreateIndex
CREATE INDEX "AdminRefundRequest_bookingId_status_idx" ON "public"."AdminRefundRequest"("bookingId", "status");

-- CreateIndex
CREATE INDEX "AdminRefundRequest_revertRequestedById_idx" ON "public"."AdminRefundRequest"("revertRequestedById");

-- AddForeignKey
ALTER TABLE "public"."AdminRefundRequest" ADD CONSTRAINT "AdminRefundRequest_revertRequestedById_fkey" FOREIGN KEY ("revertRequestedById") REFERENCES "public"."AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AdminRefundRequest" ADD CONSTRAINT "AdminRefundRequest_refundIntentId_fkey" FOREIGN KEY ("refundIntentId") REFERENCES "public"."RefundIntent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
