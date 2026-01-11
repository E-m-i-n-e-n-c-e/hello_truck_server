/*
  Warnings:

  - You are about to drop the column `razorpayLinkId` on the `DriverPaymentLink` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[referenceId]` on the table `DriverPaymentLink` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `referenceId` to the `DriverPaymentLink` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."DriverPaymentLink_razorpayLinkId_idx";

-- DropIndex
DROP INDEX "public"."DriverPaymentLink_razorpayLinkId_key";

-- AlterTable
ALTER TABLE "public"."DriverPaymentLink" DROP COLUMN "razorpayLinkId",
ADD COLUMN     "referenceId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "DriverPaymentLink_referenceId_key" ON "public"."DriverPaymentLink"("referenceId");
