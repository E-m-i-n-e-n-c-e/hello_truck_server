-- AlterTable
ALTER TABLE "public"."CustomerWalletLog" ADD COLUMN     "refundIntentId" TEXT;

-- AddForeignKey
ALTER TABLE "public"."CustomerWalletLog" ADD CONSTRAINT "CustomerWalletLog_refundIntentId_fkey" FOREIGN KEY ("refundIntentId") REFERENCES "public"."RefundIntent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
