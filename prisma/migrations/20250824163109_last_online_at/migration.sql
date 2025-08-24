/*
  Warnings:

  - You are about to drop the column `isOnline` on the `Driver` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."Driver_isOnline_driverStatus_idx";

-- AlterTable
ALTER TABLE "public"."Driver" DROP COLUMN "isOnline",
ADD COLUMN     "lastOnlineAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Driver_lastOnlineAt_driverStatus_idx" ON "public"."Driver"("lastOnlineAt", "driverStatus");
