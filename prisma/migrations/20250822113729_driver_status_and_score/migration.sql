-- CreateEnum
CREATE TYPE "public"."DriverStatus" AS ENUM ('AVAILABLE', 'ONLINE', 'OFFLINE', 'ON_RIDE');

-- AlterTable
ALTER TABLE "public"."Driver" ADD COLUMN     "score" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "public"."DriverStatusLog" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "status" "public"."DriverStatus" NOT NULL,
    "statusChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriverStatusLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DriverStatusLog_driverId_status_idx" ON "public"."DriverStatusLog"("driverId", "status");

-- CreateIndex
CREATE INDEX "DriverStatusLog_statusChangedAt_idx" ON "public"."DriverStatusLog"("statusChangedAt");

-- AddForeignKey
ALTER TABLE "public"."DriverStatusLog" ADD CONSTRAINT "DriverStatusLog_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
