-- CreateIndex
CREATE INDEX "VerificationDocumentAction_actionById_idx" ON "public"."VerificationDocumentAction"("actionById");

-- AddForeignKey
ALTER TABLE "public"."VerificationDocumentAction" ADD CONSTRAINT "VerificationDocumentAction_actionById_fkey" FOREIGN KEY ("actionById") REFERENCES "public"."AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
