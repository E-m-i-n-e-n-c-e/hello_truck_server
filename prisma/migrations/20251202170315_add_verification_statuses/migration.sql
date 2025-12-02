-- AlterTable
ALTER TABLE "public"."DriverDocuments" ADD COLUMN     "fcStatus" "public"."VerificationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "insuranceStatus" "public"."VerificationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "licenseStatus" "public"."VerificationStatus" NOT NULL DEFAULT 'PENDING';
