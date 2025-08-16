/*
  Warnings:

  - Made the column `contactName` on table `SavedAddress` required. This step will fail if there are existing NULL values in that column.
  - Made the column `contactPhone` on table `SavedAddress` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."SavedAddress" ALTER COLUMN "contactName" SET NOT NULL,
ALTER COLUMN "contactPhone" SET NOT NULL;
