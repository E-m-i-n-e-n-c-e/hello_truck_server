/*
  Warnings:

  - Made the column `payoutMethod` on table `Driver` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."Driver" ALTER COLUMN "payoutMethod" SET NOT NULL;
