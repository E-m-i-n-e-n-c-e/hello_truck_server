-- CreateIndex
CREATE INDEX "field_verification_photos_verificationRequestId_uploadedAt_idx" ON "public"."field_verification_photos"("verificationRequestId", "uploadedAt");

-- CreateIndex
CREATE INDEX "field_verification_photos_verificationRequestId_photoType_u_idx" ON "public"."field_verification_photos"("verificationRequestId", "photoType", "uploadedAt");
