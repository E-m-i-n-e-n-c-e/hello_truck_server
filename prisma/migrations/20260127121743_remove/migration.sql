/*
  Warnings:

  - The values [IN_REVIEW] on the enum `VerificationRequestStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."VerificationRequestStatus_new" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REVERT_REQUESTED', 'REVERTED', 'FINAL_APPROVED');
ALTER TABLE "public"."DriverVerificationRequest" ALTER COLUMN "status" TYPE "public"."VerificationRequestStatus_new" USING ("status"::text::"public"."VerificationRequestStatus_new");
ALTER TYPE "public"."VerificationRequestStatus" RENAME TO "VerificationRequestStatus_old";
ALTER TYPE "public"."VerificationRequestStatus_new" RENAME TO "VerificationRequestStatus";
DROP TYPE "public"."VerificationRequestStatus_old";
COMMIT;
