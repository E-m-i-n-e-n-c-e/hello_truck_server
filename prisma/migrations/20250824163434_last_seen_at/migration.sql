/*
  Warnings:

  - You are about to drop the column `lastOnlineAt` on the `Driver` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."Driver_lastOnlineAt_driverStatus_idx";

-- AlterTable
ALTER TABLE "public"."Driver" DROP COLUMN "lastOnlineAt",
ADD COLUMN     "lastSeenAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Driver_lastSeenAt_driverStatus_idx" ON "public"."Driver"("lastSeenAt", "driverStatus");
