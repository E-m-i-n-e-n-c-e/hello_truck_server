/*
  Warnings:

  - You are about to drop the column `bookingType` on the `Package` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."PackageType" AS ENUM ('PERSONAL', 'COMMERCIAL');

-- AlterTable
ALTER TABLE "public"."Package" DROP COLUMN "bookingType",
ADD COLUMN     "packageType" "public"."PackageType" NOT NULL DEFAULT 'PERSONAL';

-- DropEnum
DROP TYPE "public"."BookingType";
