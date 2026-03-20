-- DropIndex
DROP INDEX "public"."DriverVerificationRequest_driverId_createdAt_idx";

-- CreateIndex
CREATE INDEX "DriverVerificationRequest_driverId_createdAt_idx" ON "public"."DriverVerificationRequest"("driverId", "createdAt" DESC);
