-- AlterTable
ALTER TABLE "public"."DriverDocuments" ADD COLUMN     "rcBookExpiry" TIMESTAMP(3),
ADD COLUMN     "rcBookStatus" "public"."VerificationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "selfieUrl" TEXT;

-- CreateIndex
CREATE INDEX "DriverDocuments_rcBookExpiry_idx" ON "public"."DriverDocuments"("rcBookExpiry");
