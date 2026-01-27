-- AlterTable
ALTER TABLE "public"."RefundIntent" ADD COLUMN     "isApproved" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "RefundIntent_isApproved_status_idx" ON "public"."RefundIntent"("isApproved", "status");
