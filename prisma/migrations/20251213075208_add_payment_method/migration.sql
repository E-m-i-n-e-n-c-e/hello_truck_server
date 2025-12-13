-- CreateEnum
CREATE TYPE "public"."PaymentMethod" AS ENUM ('ONLINE', 'CASH');

-- AlterTable
ALTER TABLE "public"."Invoice" ADD COLUMN     "paymentMethod" "public"."PaymentMethod" NOT NULL DEFAULT 'ONLINE';

-- AlterTable
ALTER TABLE "public"."Transaction" ADD COLUMN     "paymentMethod" "public"."PaymentMethod" NOT NULL DEFAULT 'ONLINE';
