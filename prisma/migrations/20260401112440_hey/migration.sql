-- AlterTable
ALTER TABLE "public"."Payout" ADD COLUMN     "processingStartedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."RefundIntent" ADD COLUMN     "processingStartedAt" TIMESTAMP(3);
