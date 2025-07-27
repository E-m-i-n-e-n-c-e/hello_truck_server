-- CreateTable
CREATE TABLE "CustomerGstDetails" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "gstNumber" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "businessAddress" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerGstDetails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerGstDetails_gstNumber_key" ON "CustomerGstDetails"("gstNumber");

-- CreateIndex
CREATE INDEX "CustomerGstDetails_customerId_idx" ON "CustomerGstDetails"("customerId");

-- AddForeignKey
ALTER TABLE "CustomerGstDetails" ADD CONSTRAINT "CustomerGstDetails_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
