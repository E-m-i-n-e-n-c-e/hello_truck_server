-- CreateTable
CREATE TABLE "public"."DriverPaymentLink" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "razorpayLinkId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriverPaymentLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DriverPaymentLink_razorpayLinkId_key" ON "public"."DriverPaymentLink"("razorpayLinkId");

-- CreateIndex
CREATE INDEX "DriverPaymentLink_razorpayLinkId_idx" ON "public"."DriverPaymentLink"("razorpayLinkId");

-- AddForeignKey
ALTER TABLE "public"."DriverPaymentLink" ADD CONSTRAINT "DriverPaymentLink_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;
