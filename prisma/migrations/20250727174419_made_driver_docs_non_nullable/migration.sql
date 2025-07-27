/*
  Warnings:

  - Made the column `licenseUrl` on table `DriverDocuments` required. This step will fail if there are existing NULL values in that column.
  - Made the column `licenseExpiry` on table `DriverDocuments` required. This step will fail if there are existing NULL values in that column.
  - Made the column `rcBookUrl` on table `DriverDocuments` required. This step will fail if there are existing NULL values in that column.
  - Made the column `fcUrl` on table `DriverDocuments` required. This step will fail if there are existing NULL values in that column.
  - Made the column `fcExpiry` on table `DriverDocuments` required. This step will fail if there are existing NULL values in that column.
  - Made the column `insuranceUrl` on table `DriverDocuments` required. This step will fail if there are existing NULL values in that column.
  - Made the column `insuranceExpiry` on table `DriverDocuments` required. This step will fail if there are existing NULL values in that column.
  - Made the column `aadharUrl` on table `DriverDocuments` required. This step will fail if there are existing NULL values in that column.
  - Made the column `panNumber` on table `DriverDocuments` required. This step will fail if there are existing NULL values in that column.
  - Made the column `ebBillUrl` on table `DriverDocuments` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "DriverDocuments" ALTER COLUMN "licenseUrl" SET NOT NULL,
ALTER COLUMN "licenseExpiry" SET NOT NULL,
ALTER COLUMN "rcBookUrl" SET NOT NULL,
ALTER COLUMN "fcUrl" SET NOT NULL,
ALTER COLUMN "fcExpiry" SET NOT NULL,
ALTER COLUMN "insuranceUrl" SET NOT NULL,
ALTER COLUMN "insuranceExpiry" SET NOT NULL,
ALTER COLUMN "aadharUrl" SET NOT NULL,
ALTER COLUMN "panNumber" SET NOT NULL,
ALTER COLUMN "ebBillUrl" SET NOT NULL;
