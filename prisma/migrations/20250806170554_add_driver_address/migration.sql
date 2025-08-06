-- CreateTable
CREATE TABLE "DriverAddress" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "landmark" TEXT,
    "pincode" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverAddress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DriverAddress_driverId_key" ON "DriverAddress"("driverId");

-- CreateIndex
CREATE INDEX "DriverAddress_driverId_idx" ON "DriverAddress"("driverId");

-- AddForeignKey
ALTER TABLE "DriverAddress" ADD CONSTRAINT "DriverAddress_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
