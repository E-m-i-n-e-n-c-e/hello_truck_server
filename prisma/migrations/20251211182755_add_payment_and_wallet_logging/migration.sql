/*
  Warnings:

  - The values [PENALTY] on the enum `TransactionCategory` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[rzpOrderId]` on the table `Invoice` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."TransactionCategory_new" AS ENUM ('BOOKING_PAYMENT', 'BOOKING_REFUND', 'DRIVER_PAYOUT');
ALTER TABLE "public"."Transaction" ALTER COLUMN "category" TYPE "public"."TransactionCategory_new" USING ("category"::text::"public"."TransactionCategory_new");
ALTER TYPE "public"."TransactionCategory" RENAME TO "TransactionCategory_old";
ALTER TYPE "public"."TransactionCategory_new" RENAME TO "TransactionCategory";
DROP TYPE "public"."TransactionCategory_old";
COMMIT;

-- AlterTable
ALTER TABLE "public"."Booking" ADD COLUMN     "cancellationReason" TEXT;

-- AlterTable
ALTER TABLE "public"."Invoice" ADD COLUMN     "isPaid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paidAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "public"."DriverWalletLog" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "beforeBalance" DECIMAL(10,2) NOT NULL,
    "afterBalance" DECIMAL(10,2) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "bookingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriverWalletLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CustomerWalletLog" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "beforeBalance" DECIMAL(10,2) NOT NULL,
    "afterBalance" DECIMAL(10,2) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "bookingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerWalletLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DriverWalletLog_driverId_createdAt_idx" ON "public"."DriverWalletLog"("driverId", "createdAt");

-- CreateIndex
CREATE INDEX "DriverWalletLog_createdAt_idx" ON "public"."DriverWalletLog"("createdAt");

-- CreateIndex
CREATE INDEX "CustomerWalletLog_customerId_createdAt_idx" ON "public"."CustomerWalletLog"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "CustomerWalletLog_createdAt_idx" ON "public"."CustomerWalletLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_rzpOrderId_key" ON "public"."Invoice"("rzpOrderId");

-- CreateIndex
CREATE INDEX "Invoice_bookingId_idx" ON "public"."Invoice"("bookingId");

-- AddForeignKey
ALTER TABLE "public"."DriverWalletLog" ADD CONSTRAINT "DriverWalletLog_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DriverWalletLog" ADD CONSTRAINT "DriverWalletLog_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerWalletLog" ADD CONSTRAINT "CustomerWalletLog_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerWalletLog" ADD CONSTRAINT "CustomerWalletLog_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
