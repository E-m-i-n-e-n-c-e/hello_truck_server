-- AlterTable
ALTER TABLE "public"."Invoice" ADD COLUMN     "gstDetailsId" TEXT,
ADD COLUMN     "platformFee" DECIMAL(10,2) NOT NULL DEFAULT 20;

-- CreateIndex
CREATE INDEX "Invoice_gstDetailsId_idx" ON "public"."Invoice"("gstDetailsId");

-- AddForeignKey
ALTER TABLE "public"."Invoice" ADD CONSTRAINT "Invoice_gstDetailsId_fkey" FOREIGN KEY ("gstDetailsId") REFERENCES "public"."CustomerGstDetails"("id") ON DELETE SET NULL ON UPDATE CASCADE;
