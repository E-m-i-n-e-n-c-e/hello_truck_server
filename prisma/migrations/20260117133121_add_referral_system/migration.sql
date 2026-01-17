/*
  Warnings:

  - You are about to drop the column `referalCode` on the `Driver` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[referralCode]` on the table `Customer` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[referralCode]` on the table `Driver` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."Driver" DROP COLUMN "referalCode",
ADD COLUMN     "referralCode" TEXT;

-- CreateTable
CREATE TABLE "public"."CustomerReferral" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "referredId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerReferral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DriverReferral" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "referredId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriverReferral_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerReferral_referredId_key" ON "public"."CustomerReferral"("referredId");

-- CreateIndex
CREATE INDEX "CustomerReferral_referrerId_idx" ON "public"."CustomerReferral"("referrerId");

-- CreateIndex
CREATE UNIQUE INDEX "DriverReferral_referredId_key" ON "public"."DriverReferral"("referredId");

-- CreateIndex
CREATE INDEX "DriverReferral_referrerId_idx" ON "public"."DriverReferral"("referrerId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_referralCode_key" ON "public"."Customer"("referralCode");

-- CreateIndex
CREATE INDEX "Customer_referralCode_idx" ON "public"."Customer"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_referralCode_key" ON "public"."Driver"("referralCode");

-- AddForeignKey
ALTER TABLE "public"."CustomerReferral" ADD CONSTRAINT "CustomerReferral_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "public"."Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerReferral" ADD CONSTRAINT "CustomerReferral_referredId_fkey" FOREIGN KEY ("referredId") REFERENCES "public"."Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DriverReferral" ADD CONSTRAINT "DriverReferral_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "public"."Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DriverReferral" ADD CONSTRAINT "DriverReferral_referredId_fkey" FOREIGN KEY ("referredId") REFERENCES "public"."Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;
