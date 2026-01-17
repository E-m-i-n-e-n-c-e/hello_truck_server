-- AlterTable
ALTER TABLE "public"."DriverDocuments" ADD COLUMN     "aadharNumberEncrypted" TEXT NOT NULL DEFAULT 'RandomHash',
ADD COLUMN     "aadharNumberHash" TEXT NOT NULL DEFAULT 'RandomHash';

-- CreateIndex
CREATE INDEX "DriverDocuments_aadharNumberHash_idx" ON "public"."DriverDocuments"("aadharNumberHash");
