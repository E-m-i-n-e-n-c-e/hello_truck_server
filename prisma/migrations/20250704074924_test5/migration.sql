-- CreateIndex
CREATE INDEX "OtpVerification_phoneNumber_verified_expiresAt_createdAt_idx" ON "OtpVerification"("phoneNumber", "verified", "expiresAt", "createdAt");

-- CreateIndex
CREATE INDEX "OtpVerification_expiresAt_idx" ON "OtpVerification"("expiresAt");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
