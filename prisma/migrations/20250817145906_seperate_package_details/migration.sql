/*
  Warnings:

  - You are about to drop the column `approximateWeight` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `averageWeight` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `bookingType` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `bundleWeight` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `gstBillUrl` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `numberOfProducts` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `packageDescription` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `packageDimensions` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `packageImageUrls` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `productName` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `productType` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `transportDocUrls` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `weightUnit` on the `Booking` table. All the data in the column will be lost.
  - Added the required column `packageId` to the `Booking` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."DimensionUnit" AS ENUM ('CM', 'INCHES');

-- AlterTable
ALTER TABLE "public"."Booking" DROP COLUMN "approximateWeight",
DROP COLUMN "averageWeight",
DROP COLUMN "bookingType",
DROP COLUMN "bundleWeight",
DROP COLUMN "gstBillUrl",
DROP COLUMN "numberOfProducts",
DROP COLUMN "packageDescription",
DROP COLUMN "packageDimensions",
DROP COLUMN "packageImageUrls",
DROP COLUMN "productName",
DROP COLUMN "productType",
DROP COLUMN "transportDocUrls",
DROP COLUMN "weightUnit",
ADD COLUMN     "packageId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "public"."Package" (
    "id" TEXT NOT NULL,
    "bookingType" "public"."BookingType" NOT NULL,
    "productType" "public"."ProductType" NOT NULL,
    "productName" TEXT,
    "approximateWeight" DECIMAL(10,2),
    "weightUnit" "public"."WeightUnit" NOT NULL DEFAULT 'KG',
    "averageWeight" DECIMAL(10,2),
    "bundleWeight" DECIMAL(10,2),
    "numberOfProducts" INTEGER,
    "length" DECIMAL(10,2),
    "width" DECIMAL(10,2),
    "height" DECIMAL(10,2),
    "dimensionUnit" "public"."DimensionUnit" DEFAULT 'CM',
    "description" TEXT,
    "packageImageUrl" TEXT,
    "gstBillUrl" TEXT,
    "transportDocUrls" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Package_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."Booking" ADD CONSTRAINT "Booking_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "public"."Package"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
