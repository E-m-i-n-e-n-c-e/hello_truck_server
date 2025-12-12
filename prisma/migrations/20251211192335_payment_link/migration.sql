/*
  Warnings:

  - You are about to drop the column `rzpOrderId` on the `Invoice` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[rzpPaymentLinkId]` on the table `Invoice` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."Invoice_rzpOrderId_key";

-- AlterTable
ALTER TABLE "public"."Invoice" DROP COLUMN "rzpOrderId",
ADD COLUMN     "rzpPaymentLinkId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_rzpPaymentLinkId_key" ON "public"."Invoice"("rzpPaymentLinkId");
