/*
  Warnings:

  - You are about to drop the column `rzpPaymentLinkId` on the `WebhookLog` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."WebhookLog_rzpPaymentLinkId_idx";

-- AlterTable
ALTER TABLE "public"."WebhookLog" DROP COLUMN "rzpPaymentLinkId";
