/*
  Warnings:

  - You are about to drop the column `error` on the `WebhookLog` table. All the data in the column will be lost.
  - You are about to drop the column `processed` on the `WebhookLog` table. All the data in the column will be lost.
  - You are about to drop the column `processedAt` on the `WebhookLog` table. All the data in the column will be lost.
  - You are about to drop the column `razorpayOrderId` on the `WebhookLog` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."WebhookLog_processed_createdAt_idx";

-- DropIndex
DROP INDEX "public"."WebhookLog_razorpayOrderId_idx";

-- AlterTable
ALTER TABLE "public"."WebhookLog" DROP COLUMN "error",
DROP COLUMN "processed",
DROP COLUMN "processedAt",
DROP COLUMN "razorpayOrderId",
ADD COLUMN     "rzpPaymentLinkId" TEXT;

-- CreateIndex
CREATE INDEX "WebhookLog_rzpPaymentLinkId_idx" ON "public"."WebhookLog"("rzpPaymentLinkId");
