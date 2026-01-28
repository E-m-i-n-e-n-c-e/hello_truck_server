-- CreateEnum
CREATE TYPE "public"."VerificationActionType" AS ENUM ('APPROVED', 'REJECTED', 'REVERT_REQUESTED', 'REVERT_APPROVED', 'REVERT_REJECTED');

-- CreateTable
CREATE TABLE "public"."VerificationAction" (
    "id" TEXT NOT NULL,
    "verificationRequestId" TEXT NOT NULL,
    "actionType" "public"."VerificationActionType" NOT NULL,
    "reason" TEXT,
    "actionById" TEXT NOT NULL,
    "actionAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VerificationAction_verificationRequestId_idx" ON "public"."VerificationAction"("verificationRequestId");

-- CreateIndex
CREATE INDEX "VerificationAction_actionById_idx" ON "public"."VerificationAction"("actionById");

-- CreateIndex
CREATE INDEX "VerificationAction_actionAt_idx" ON "public"."VerificationAction"("actionAt");

-- AddForeignKey
ALTER TABLE "public"."VerificationAction" ADD CONSTRAINT "VerificationAction_verificationRequestId_fkey" FOREIGN KEY ("verificationRequestId") REFERENCES "public"."DriverVerificationRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VerificationAction" ADD CONSTRAINT "VerificationAction_actionById_fkey" FOREIGN KEY ("actionById") REFERENCES "public"."AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
