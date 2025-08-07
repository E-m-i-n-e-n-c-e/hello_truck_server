/*
  Warnings:

  - You are about to drop the column `aadharNumber` on the `VehicleOwner` table. All the data in the column will be lost.
  - Added the required column `aadharUrl` to the `VehicleOwner` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "VehicleOwner_aadharNumber_idx";

-- DropIndex
DROP INDEX "VehicleOwner_aadharNumber_key";

-- AlterTable
ALTER TABLE "VehicleOwner" DROP COLUMN "aadharNumber",
ADD COLUMN     "aadharUrl" TEXT NOT NULL;
