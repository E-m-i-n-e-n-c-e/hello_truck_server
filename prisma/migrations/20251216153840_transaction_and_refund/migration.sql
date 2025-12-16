-- AlterTable
ALTER TABLE "public"."Transaction" ADD COLUMN     "refundIntentId" TEXT;

-- AddForeignKey
ALTER TABLE "public"."Transaction" ADD CONSTRAINT "Transaction_refundIntentId_fkey" FOREIGN KEY ("refundIntentId") REFERENCES "public"."RefundIntent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
