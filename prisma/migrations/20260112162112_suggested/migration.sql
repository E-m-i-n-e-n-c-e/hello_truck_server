-- AlterTable
ALTER TABLE "public"."DriverDocuments" ADD COLUMN     "suggestedFcExpiry" TIMESTAMP(3),
ADD COLUMN     "suggestedInsuranceExpiry" TIMESTAMP(3),
ADD COLUMN     "suggestedLicenseExpiry" TIMESTAMP(3),
ADD COLUMN     "suggestedRcBookExpiry" TIMESTAMP(3);
