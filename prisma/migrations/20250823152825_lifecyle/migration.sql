/*
  Warnings:

  - The values [PICKUP_OTP_VERIFIED,DROP_OTP_VERIFIED] on the enum `LifecycleEventType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."LifecycleEventType_new" AS ENUM ('PICKUP_ARRIVED', 'PICKUP_VERIFIED', 'IN_TRANSIT', 'DROP_ARRIVED', 'DROP_VERIFIED', 'COMPLETED', 'CANCELLED', 'EXPIRED');
ALTER TABLE "public"."BookingLifecycleEvent" ALTER COLUMN "eventType" TYPE "public"."LifecycleEventType_new" USING ("eventType"::text::"public"."LifecycleEventType_new");
ALTER TYPE "public"."LifecycleEventType" RENAME TO "LifecycleEventType_old";
ALTER TYPE "public"."LifecycleEventType_new" RENAME TO "LifecycleEventType";
DROP TYPE "public"."LifecycleEventType_old";
COMMIT;
