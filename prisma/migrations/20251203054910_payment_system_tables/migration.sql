-- CreateEnum
CREATE TYPE "public"."TransactionType" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "public"."TransactionCategory" AS ENUM ('BOOKING_PAYMENT', 'BOOKING_REFUND', 'DRIVER_PAYOUT', 'PENALTY');

-- CreateEnum
CREATE TYPE "public"."PayoutStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- AlterTable
ALTER TABLE "public"."Customer" ADD COLUMN     "walletBalance" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "public"."Driver" ADD COLUMN     "walletBalance" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "public"."Transaction" (
    "id" TEXT NOT NULL,
    "customerId" TEXT,
    "driverId" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "type" "public"."TransactionType" NOT NULL,
    "category" "public"."TransactionCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "bookingId" TEXT,
    "payoutId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Payout" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "razorpayPayoutId" TEXT,
    "status" "public"."PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "failureReason" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WebhookLog" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "razorpayOrderId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "signature" TEXT NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Transaction_customerId_createdAt_idx" ON "public"."Transaction"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "Transaction_driverId_createdAt_idx" ON "public"."Transaction"("driverId", "createdAt");

-- CreateIndex
CREATE INDEX "Transaction_bookingId_idx" ON "public"."Transaction"("bookingId");

-- CreateIndex
CREATE INDEX "Transaction_payoutId_idx" ON "public"."Transaction"("payoutId");

-- CreateIndex
CREATE INDEX "Transaction_category_createdAt_idx" ON "public"."Transaction"("category", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_razorpayPayoutId_key" ON "public"."Payout"("razorpayPayoutId");

-- CreateIndex
CREATE INDEX "Payout_driverId_status_idx" ON "public"."Payout"("driverId", "status");

-- CreateIndex
CREATE INDEX "Payout_status_createdAt_idx" ON "public"."Payout"("status", "createdAt");

-- CreateIndex
CREATE INDEX "WebhookLog_razorpayOrderId_idx" ON "public"."WebhookLog"("razorpayOrderId");

-- CreateIndex
CREATE INDEX "WebhookLog_processed_createdAt_idx" ON "public"."WebhookLog"("processed", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."Transaction" ADD CONSTRAINT "Transaction_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Transaction" ADD CONSTRAINT "Transaction_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Transaction" ADD CONSTRAINT "Transaction_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Transaction" ADD CONSTRAINT "Transaction_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "public"."Payout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payout" ADD CONSTRAINT "Payout_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;
