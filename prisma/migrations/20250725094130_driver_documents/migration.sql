-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('THREE_WHEELER', 'FOUR_WHEELER');

-- CreateEnum
CREATE TYPE "VehicleBodyType" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "FuelType" AS ENUM ('DIESEL', 'PETROL', 'EV', 'CNG');

-- AlterTable
ALTER TABLE "Driver" ADD COLUMN     "alternatePhone" TEXT,
ADD COLUMN     "photo" TEXT;

-- CreateTable
CREATE TABLE "DriverDocuments" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "licenseUrl" TEXT,
    "licenseExpiry" TIMESTAMP(3),
    "rcBookUrl" TEXT,
    "fcUrl" TEXT,
    "fcExpiry" TIMESTAMP(3),
    "insuranceUrl" TEXT,
    "insuranceExpiry" TIMESTAMP(3),
    "aadharUrl" TEXT,
    "panNumber" TEXT,
    "ebBillUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverDocuments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DriverDocuments_driverId_key" ON "DriverDocuments"("driverId");

-- CreateIndex
CREATE UNIQUE INDEX "DriverDocuments_panNumber_key" ON "DriverDocuments"("panNumber");

-- CreateIndex
CREATE INDEX "DriverDocuments_licenseExpiry_idx" ON "DriverDocuments"("licenseExpiry");

-- CreateIndex
CREATE INDEX "DriverDocuments_fcExpiry_idx" ON "DriverDocuments"("fcExpiry");

-- CreateIndex
CREATE INDEX "DriverDocuments_insuranceExpiry_idx" ON "DriverDocuments"("insuranceExpiry");

-- CreateIndex
CREATE INDEX "Customer_isActive_idx" ON "Customer"("isActive");

-- CreateIndex
CREATE INDEX "Driver_isActive_verificationStatus_idx" ON "Driver"("isActive", "verificationStatus");

-- AddForeignKey
ALTER TABLE "DriverDocuments" ADD CONSTRAINT "DriverDocuments_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
