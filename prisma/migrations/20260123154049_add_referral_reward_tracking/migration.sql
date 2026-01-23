-- AlterTable
ALTER TABLE "public"."Customer" ADD COLUMN     "bookingCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "public"."CustomerReferral" ADD COLUMN     "referredRewardApplied" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "referrerRewardApplied" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."DriverReferral" ADD COLUMN     "referredRewardApplied" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "referrerRewardApplied" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "CustomerReferral_referredId_referrerRewardApplied_idx" ON "public"."CustomerReferral"("referredId", "referrerRewardApplied");

-- CreateIndex
CREATE INDEX "DriverReferral_referredId_referrerRewardApplied_idx" ON "public"."DriverReferral"("referredId", "referrerRewardApplied");
