-- CreateEnum
CREATE TYPE "public"."AdminRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'AGENT', 'FIELD_AGENT', 'CUSTOMER_SUPPORT');

-- CreateEnum
CREATE TYPE "public"."DriverVerificationType" AS ENUM ('NEW_DRIVER', 'EXISTING_DRIVER');

-- CreateEnum
CREATE TYPE "public"."VerificationRequestStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'REVERT_REQUESTED', 'REVERTED', 'FINAL_APPROVED');

-- CreateEnum
CREATE TYPE "public"."DocumentActionType" AS ENUM ('APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."FieldPhotoType" AS ENUM ('VEHICLE_FRONT', 'VEHICLE_BACK', 'VEHICLE_LEFT', 'VEHICLE_RIGHT', 'DRIVER_WITH_VEHICLE', 'CHASSIS_NUMBER');

-- CreateEnum
CREATE TYPE "public"."AdminRefundStatus" AS ENUM ('INITIATED', 'APPROVED', 'REVERT_REQUESTED', 'REVERTED', 'COMPLETED');

-- CreateTable
CREATE TABLE "public"."admin_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "public"."AdminRole" NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "public"."AdminRole" NOT NULL,
    "actionType" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "beforeSnapshot" JSONB,
    "afterSnapshot" JSONB,
    "entityId" TEXT,
    "entityType" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."driver_verification_requests" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "verificationType" "public"."DriverVerificationType" NOT NULL,
    "ticketId" TEXT,
    "assignedToId" TEXT,
    "status" "public"."VerificationRequestStatus" NOT NULL,
    "reVerificationReason" TEXT,
    "bufferExpiresAt" TIMESTAMP(3),
    "revertReason" TEXT,
    "revertRequestedById" TEXT,
    "revertRequestedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_verification_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."verification_document_actions" (
    "id" TEXT NOT NULL,
    "verificationRequestId" TEXT NOT NULL,
    "documentField" TEXT NOT NULL,
    "action" "public"."DocumentActionType" NOT NULL,
    "rejectionReason" TEXT,
    "actionById" TEXT NOT NULL,
    "actionAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_document_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."field_verification_photos" (
    "id" TEXT NOT NULL,
    "verificationRequestId" TEXT NOT NULL,
    "photoType" "public"."FieldPhotoType" NOT NULL,
    "url" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "field_verification_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."admin_refund_requests" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "driverId" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "notes" TEXT,
    "evidenceUrls" TEXT[],
    "status" "public"."AdminRefundStatus" NOT NULL,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "bufferExpiresAt" TIMESTAMP(3),
    "revertReason" TEXT,
    "revertRequestedById" TEXT,
    "revertRequestedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "refundIntentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_refund_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."support_notes" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."admin_notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "entityId" TEXT,
    "entityType" TEXT,
    "actionUrl" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "public"."admin_users"("email");

-- CreateIndex
CREATE INDEX "audit_logs_userId_timestamp_idx" ON "public"."audit_logs"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_module_timestamp_idx" ON "public"."audit_logs"("module", "timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_actionType_timestamp_idx" ON "public"."audit_logs"("actionType", "timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "public"."audit_logs"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "driver_verification_requests_ticketId_key" ON "public"."driver_verification_requests"("ticketId");

-- CreateIndex
CREATE INDEX "driver_verification_requests_driverId_idx" ON "public"."driver_verification_requests"("driverId");

-- CreateIndex
CREATE INDEX "driver_verification_requests_status_idx" ON "public"."driver_verification_requests"("status");

-- CreateIndex
CREATE INDEX "driver_verification_requests_assignedToId_idx" ON "public"."driver_verification_requests"("assignedToId");

-- CreateIndex
CREATE INDEX "driver_verification_requests_createdAt_idx" ON "public"."driver_verification_requests"("createdAt");

-- CreateIndex
CREATE INDEX "verification_document_actions_verificationRequestId_idx" ON "public"."verification_document_actions"("verificationRequestId");

-- CreateIndex
CREATE INDEX "field_verification_photos_verificationRequestId_idx" ON "public"."field_verification_photos"("verificationRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "admin_refund_requests_bookingId_key" ON "public"."admin_refund_requests"("bookingId");

-- CreateIndex
CREATE INDEX "admin_refund_requests_customerId_idx" ON "public"."admin_refund_requests"("customerId");

-- CreateIndex
CREATE INDEX "admin_refund_requests_driverId_idx" ON "public"."admin_refund_requests"("driverId");

-- CreateIndex
CREATE INDEX "admin_refund_requests_status_idx" ON "public"."admin_refund_requests"("status");

-- CreateIndex
CREATE INDEX "admin_refund_requests_createdAt_idx" ON "public"."admin_refund_requests"("createdAt");

-- CreateIndex
CREATE INDEX "support_notes_bookingId_idx" ON "public"."support_notes"("bookingId");

-- CreateIndex
CREATE INDEX "support_notes_createdAt_idx" ON "public"."support_notes"("createdAt");

-- CreateIndex
CREATE INDEX "admin_notifications_userId_isRead_idx" ON "public"."admin_notifications"("userId", "isRead");

-- CreateIndex
CREATE INDEX "admin_notifications_createdAt_idx" ON "public"."admin_notifications"("createdAt");

-- AddForeignKey
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."driver_verification_requests" ADD CONSTRAINT "driver_verification_requests_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."driver_verification_requests" ADD CONSTRAINT "driver_verification_requests_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "public"."admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."verification_document_actions" ADD CONSTRAINT "verification_document_actions_verificationRequestId_fkey" FOREIGN KEY ("verificationRequestId") REFERENCES "public"."driver_verification_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."field_verification_photos" ADD CONSTRAINT "field_verification_photos_verificationRequestId_fkey" FOREIGN KEY ("verificationRequestId") REFERENCES "public"."driver_verification_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."admin_refund_requests" ADD CONSTRAINT "admin_refund_requests_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."admin_refund_requests" ADD CONSTRAINT "admin_refund_requests_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."admin_refund_requests" ADD CONSTRAINT "admin_refund_requests_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."admin_refund_requests" ADD CONSTRAINT "admin_refund_requests_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."admin_refund_requests" ADD CONSTRAINT "admin_refund_requests_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "public"."admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."support_notes" ADD CONSTRAINT "support_notes_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."admin_notifications" ADD CONSTRAINT "admin_notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
