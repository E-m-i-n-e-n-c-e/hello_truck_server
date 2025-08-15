/*
  Warnings:

  - You are about to drop the column `addressLine1` on the `Address` table. All the data in the column will be lost.
  - You are about to drop the column `city` on the `Address` table. All the data in the column will be lost.
  - You are about to drop the column `country` on the `Address` table. All the data in the column will be lost.
  - You are about to drop the column `district` on the `Address` table. All the data in the column will be lost.
  - You are about to drop the column `pincode` on the `Address` table. All the data in the column will be lost.
  - You are about to drop the column `state` on the `Address` table. All the data in the column will be lost.
  - You are about to drop the column `label` on the `SavedAddress` table. All the data in the column will be lost.
  - You are about to drop the column `phoneNumber` on the `SavedAddress` table. All the data in the column will be lost.
  - Added the required column `name` to the `SavedAddress` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Address" DROP COLUMN "addressLine1",
DROP COLUMN "city",
DROP COLUMN "country",
DROP COLUMN "district",
DROP COLUMN "pincode",
DROP COLUMN "state",
ADD COLUMN     "addressDetails" TEXT;

-- AlterTable
ALTER TABLE "SavedAddress" DROP COLUMN "label",
DROP COLUMN "phoneNumber",
ADD COLUMN     "contactName" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "noteToDriver" TEXT;
