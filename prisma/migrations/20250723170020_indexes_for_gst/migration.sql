-- DropIndex
DROP INDEX "CustomerGstDetails_customerId_idx";

-- CreateIndex
CREATE INDEX "CustomerGstDetails_customerId_isActive_idx" ON "CustomerGstDetails"("customerId", "isActive");

-- CreateIndex
CREATE INDEX "CustomerGstDetails_createdAt_idx" ON "CustomerGstDetails"("createdAt");
