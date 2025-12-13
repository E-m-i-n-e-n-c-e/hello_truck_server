-- AlterTable
ALTER TABLE "public"."Invoice" ALTER COLUMN "paymentMethod" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."Transaction" ALTER COLUMN "paymentMethod" DROP DEFAULT;
