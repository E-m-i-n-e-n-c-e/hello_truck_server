/*
  Warnings:

  - You are about to drop the column `averageWeight` on the `Package` table. All the data in the column will be lost.
  - Made the column `approximateWeight` on table `Package` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."Package" DROP COLUMN "averageWeight",
ALTER COLUMN "approximateWeight" SET NOT NULL;
