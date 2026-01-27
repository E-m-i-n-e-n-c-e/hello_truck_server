/*
  Warnings:

  - You are about to drop the `admin_notifications` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `admin_refund_requests` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `admin_sessions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `admin_users` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `audit_logs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `driver_verification_requests` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `support_notes` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `verification_document_actions` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."admin_notifications" DROP CONSTRAINT "admin_notifications_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."admin_refund_requests" DROP CONSTRAINT "admin_refund_requests_approvedById_fkey";

-- DropForeignKey
ALTER TABLE "public"."admin_refund_requests" DROP CONSTRAINT "admin_refund_requests_bookingId_fkey";

-- DropForeignKey
ALTER TABLE "public"."admin_refund_requests" DROP CONSTRAINT "admin_refund_requests_createdById_fkey";

-- DropForeignKey
ALTER TABLE "public"."admin_refund_requests" DROP CONSTRAINT "admin_refund_requests_customerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."admin_refund_requests" DROP CONSTRAINT "admin_refund_requests_driverId_fkey";

-- DropForeignKey
ALTER TABLE "public"."admin_sessions" DROP CONSTRAINT "admin_sessions_adminUserId_fkey";

-- DropForeignKey
ALTER TABLE "public"."audit_logs" DROP CONSTRAINT "audit_logs_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."driver_verification_requests" DROP CONSTRAINT "driver_verification_requests_assignedToId_fkey";

-- DropForeignKey
ALTER TABLE "public"."driver_verification_requests" DROP CONSTRAINT "driver_verification_requests_driverId_fkey";

-- DropForeignKey
ALTER TABLE "public"."field_verification_photos" DROP CONSTRAINT "field_verification_photos_verificationRequestId_fkey";

-- DropForeignKey
ALTER TABLE "public"."support_notes" DROP CONSTRAINT "support_notes_bookingId_fkey";

-- DropForeignKey
ALTER TABLE "public"."verification_document_actions" DROP CONSTRAINT "verification_document_actions_verificationRequestId_fkey";

-- DropTable
DROP TABLE "public"."admin_notifications";

-- DropTable
DROP TABLE "public"."admin_refund_requests";

-- DropTable
DROP TABLE "public"."admin_sessions";

-- DropTable
DROP TABLE "public"."admin_users";

-- DropTable
DROP TABLE "public"."audit_logs";

-- DropTable
DROP TABLE "public"."driver_verification_requests";

-- DropTable
DROP TABLE "public"."support_notes";

-- DropTable
DROP TABLE "public"."verification_document_actions";

-- CreateTable
CREATE TABLE "public"."AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "public"."AdminRole" NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AdminSession" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "fcmToken" TEXT,
    "lastNotifiedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AuditLog" (
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

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DriverVerificationRequest" (
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

    CONSTRAINT "DriverVerificationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VerificationDocumentAction" (
    "id" TEXT NOT NULL,
    "verificationRequestId" TEXT NOT NULL,
    "documentField" TEXT NOT NULL,
    "action" "public"."DocumentActionType" NOT NULL,
    "rejectionReason" TEXT,
    "actionById" TEXT NOT NULL,
    "actionAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationDocumentAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AdminRefundRequest" (
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

    CONSTRAINT "AdminRefundRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SupportNote" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AdminNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "entityId" TEXT,
    "entityType" TEXT,
    "actionUrl" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "public"."AdminUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AdminSession_refreshTokenHash_key" ON "public"."AdminSession"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "AdminSession_adminUserId_idx" ON "public"."AdminSession"("adminUserId");

-- CreateIndex
CREATE INDEX "AdminSession_expiresAt_idx" ON "public"."AdminSession"("expiresAt");

-- CreateIndex
CREATE INDEX "AdminSession_refreshTokenHash_idx" ON "public"."AdminSession"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "AdminSession_fcmToken_idx" ON "public"."AdminSession"("fcmToken");

-- CreateIndex
CREATE INDEX "AuditLog_userId_timestamp_idx" ON "public"."AuditLog"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "AuditLog_module_timestamp_idx" ON "public"."AuditLog"("module", "timestamp");

-- CreateIndex
CREATE INDEX "AuditLog_actionType_timestamp_idx" ON "public"."AuditLog"("actionType", "timestamp");

-- CreateIndex
CREATE INDEX "AuditLog_timestamp_idx" ON "public"."AuditLog"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "DriverVerificationRequest_ticketId_key" ON "public"."DriverVerificationRequest"("ticketId");

-- CreateIndex
CREATE INDEX "DriverVerificationRequest_driverId_idx" ON "public"."DriverVerificationRequest"("driverId");

-- CreateIndex
CREATE INDEX "DriverVerificationRequest_status_idx" ON "public"."DriverVerificationRequest"("status");

-- CreateIndex
CREATE INDEX "DriverVerificationRequest_assignedToId_idx" ON "public"."DriverVerificationRequest"("assignedToId");

-- CreateIndex
CREATE INDEX "DriverVerificationRequest_createdAt_idx" ON "public"."DriverVerificationRequest"("createdAt");

-- CreateIndex
CREATE INDEX "VerificationDocumentAction_verificationRequestId_idx" ON "public"."VerificationDocumentAction"("verificationRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminRefundRequest_bookingId_key" ON "public"."AdminRefundRequest"("bookingId");

-- CreateIndex
CREATE INDEX "AdminRefundRequest_customerId_idx" ON "public"."AdminRefundRequest"("customerId");

-- CreateIndex
CREATE INDEX "AdminRefundRequest_driverId_idx" ON "public"."AdminRefundRequest"("driverId");

-- CreateIndex
CREATE INDEX "AdminRefundRequest_status_idx" ON "public"."AdminRefundRequest"("status");

-- CreateIndex
CREATE INDEX "AdminRefundRequest_createdAt_idx" ON "public"."AdminRefundRequest"("createdAt");

-- CreateIndex
CREATE INDEX "SupportNote_bookingId_idx" ON "public"."SupportNote"("bookingId");

-- CreateIndex
CREATE INDEX "SupportNote_createdAt_idx" ON "public"."SupportNote"("createdAt");

-- CreateIndex
CREATE INDEX "AdminNotification_userId_isRead_idx" ON "public"."AdminNotification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "AdminNotification_createdAt_idx" ON "public"."AdminNotification"("createdAt");

-- AddForeignKey
ALTER TABLE "public"."AdminSession" ADD CONSTRAINT "AdminSession_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "public"."AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DriverVerificationRequest" ADD CONSTRAINT "DriverVerificationRequest_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DriverVerificationRequest" ADD CONSTRAINT "DriverVerificationRequest_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "public"."AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VerificationDocumentAction" ADD CONSTRAINT "VerificationDocumentAction_verificationRequestId_fkey" FOREIGN KEY ("verificationRequestId") REFERENCES "public"."DriverVerificationRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."field_verification_photos" ADD CONSTRAINT "field_verification_photos_verificationRequestId_fkey" FOREIGN KEY ("verificationRequestId") REFERENCES "public"."DriverVerificationRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AdminRefundRequest" ADD CONSTRAINT "AdminRefundRequest_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AdminRefundRequest" ADD CONSTRAINT "AdminRefundRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AdminRefundRequest" ADD CONSTRAINT "AdminRefundRequest_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AdminRefundRequest" ADD CONSTRAINT "AdminRefundRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AdminRefundRequest" ADD CONSTRAINT "AdminRefundRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "public"."AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SupportNote" ADD CONSTRAINT "SupportNote_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AdminNotification" ADD CONSTRAINT "AdminNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
