/*
  Warnings:

  - You are about to drop the column `actorType` on the `BookingLifecycleEvent` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."BookingLifecycleEvent" DROP COLUMN "actorType";

-- DropEnum
DROP TYPE "public"."ActorType";
