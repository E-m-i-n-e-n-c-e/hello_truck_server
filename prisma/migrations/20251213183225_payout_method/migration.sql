-- CreateEnum
CREATE TYPE "public"."PayoutMethodType" AS ENUM ('BANK_ACCOUNT', 'VPA');

-- AlterTable
ALTER TABLE "public"."Driver" ADD COLUMN     "payoutMethod" "public"."PayoutMethodType";
