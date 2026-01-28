-- AlterTable
ALTER TABLE "public"."AdminNotification" ADD COLUMN     "driverId" TEXT;

-- CreateIndex
CREATE INDEX "AdminNotification_driverId_idx" ON "public"."AdminNotification"("driverId");
