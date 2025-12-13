/*
  Warnings:

  - You are about to drop the column `paymentMethod` on the `Invoice` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Invoice" DROP COLUMN "paymentMethod";
