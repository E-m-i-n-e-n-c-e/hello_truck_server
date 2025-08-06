-- AlterTable
ALTER TABLE "DriverDocuments" ALTER COLUMN "licenseExpiry" DROP NOT NULL,
ALTER COLUMN "fcExpiry" DROP NOT NULL,
ALTER COLUMN "insuranceExpiry" DROP NOT NULL;
