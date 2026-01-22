/*
  Warnings:

  - You are about to drop the column `gstDetailsId` on the `Invoice` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Invoice" DROP CONSTRAINT "Invoice_gstDetailsId_fkey";

-- DropIndex
DROP INDEX "public"."Invoice_gstDetailsId_idx";

-- AlterTable
ALTER TABLE "public"."Booking" ADD COLUMN     "gstNumber" TEXT;

-- AlterTable
ALTER TABLE "public"."Invoice" DROP COLUMN "gstDetailsId",
ADD COLUMN     "gstNumber" TEXT;

-- CreateIndex
CREATE INDEX "Invoice_gstNumber_idx" ON "public"."Invoice"("gstNumber");
