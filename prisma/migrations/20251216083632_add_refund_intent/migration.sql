-- CreateEnum
CREATE TYPE "public"."RefundStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'NOT_REQUIRED');

-- CreateTable
CREATE TABLE "public"."RefundIntent" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "walletRefundAmount" DECIMAL(10,2) NOT NULL,
    "razorpayRefundAmount" DECIMAL(10,2) NOT NULL,
    "cancellationCharge" DECIMAL(10,2) NOT NULL,
    "rzpPaymentId" TEXT,
    "rzpRefundId" TEXT,
    "status" "public"."RefundStatus" NOT NULL DEFAULT 'PENDING',
    "failureReason" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "nextRetryAt" TIMESTAMP(3),

    CONSTRAINT "RefundIntent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RefundIntent_bookingId_key" ON "public"."RefundIntent"("bookingId");

-- CreateIndex
CREATE INDEX "RefundIntent_status_nextRetryAt_idx" ON "public"."RefundIntent"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "RefundIntent_bookingId_idx" ON "public"."RefundIntent"("bookingId");

-- AddForeignKey
ALTER TABLE "public"."RefundIntent" ADD CONSTRAINT "RefundIntent_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RefundIntent" ADD CONSTRAINT "RefundIntent_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
