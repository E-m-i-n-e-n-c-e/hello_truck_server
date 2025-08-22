-- AlterTable
ALTER TABLE "public"."CustomerSession" ADD COLUMN     "fcmToken" TEXT,
ADD COLUMN     "lastNotifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."DriverSession" ADD COLUMN     "fcmToken" TEXT,
ADD COLUMN     "lastNotifiedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "CustomerSession_customerId_idx" ON "public"."CustomerSession"("customerId");

-- CreateIndex
CREATE INDEX "CustomerSession_fcmToken_idx" ON "public"."CustomerSession"("fcmToken");

-- CreateIndex
CREATE INDEX "DriverSession_driverId_idx" ON "public"."DriverSession"("driverId");

-- CreateIndex
CREATE INDEX "DriverSession_fcmToken_idx" ON "public"."DriverSession"("fcmToken");
