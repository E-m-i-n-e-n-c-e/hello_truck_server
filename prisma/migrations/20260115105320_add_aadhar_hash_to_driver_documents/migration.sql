-- AlterTable
ALTER TABLE "public"."DriverDocuments" ADD COLUMN     "aadharNumberHash" TEXT NOT NULL DEFAULT 'randomhash';
