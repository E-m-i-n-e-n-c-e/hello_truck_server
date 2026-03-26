-- CreateIndex
CREATE INDEX "AdminSession_refreshTokenHash_idx" ON "public"."AdminSession"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "AuditLog_timestamp_idx" ON "public"."AuditLog"("timestamp");

-- CreateIndex
CREATE INDEX "DriverVerificationRequest_createdAt_idx" ON "public"."DriverVerificationRequest"("createdAt");

-- CreateIndex
CREATE INDEX "DriverVerificationRequest_driverId_idx" ON "public"."DriverVerificationRequest"("driverId");

-- CreateIndex
CREATE INDEX "Invoice_bookingId_idx" ON "public"."Invoice"("bookingId");

-- CreateIndex
CREATE INDEX "RefundIntent_status_idx" ON "public"."RefundIntent"("status");
