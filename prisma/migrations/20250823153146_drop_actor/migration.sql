/*
  Warnings:

  - You are about to drop the column `actorId` on the `BookingLifecycleEvent` table. All the data in the column will be lost.
  - You are about to drop the column `photoUrl` on the `BookingLifecycleEvent` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."BookingLifecycleEvent" DROP COLUMN "actorId",
DROP COLUMN "photoUrl";
