-- CreateIndex
CREATE INDEX "AdminRefundRequest_bookingId_createdAt_idx" ON "public"."AdminRefundRequest"("bookingId", "createdAt" DESC);
