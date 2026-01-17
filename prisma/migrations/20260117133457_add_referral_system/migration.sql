/*
  Warnings:

  - You are about to drop the column `aadharNumberHash` on the `DriverDocuments` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."DriverDocuments_aadharNumberHash_idx";

-- AlterTable
ALTER TABLE "public"."DriverDocuments" DROP COLUMN "aadharNumberHash";
