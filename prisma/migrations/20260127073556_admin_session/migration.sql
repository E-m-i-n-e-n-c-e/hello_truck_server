-- CreateTable
CREATE TABLE "public"."admin_sessions" (
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

    CONSTRAINT "admin_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_sessions_refreshTokenHash_key" ON "public"."admin_sessions"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "admin_sessions_adminUserId_idx" ON "public"."admin_sessions"("adminUserId");

-- CreateIndex
CREATE INDEX "admin_sessions_expiresAt_idx" ON "public"."admin_sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "admin_sessions_refreshTokenHash_idx" ON "public"."admin_sessions"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "admin_sessions_fcmToken_idx" ON "public"."admin_sessions"("fcmToken");

-- AddForeignKey
ALTER TABLE "public"."admin_sessions" ADD CONSTRAINT "admin_sessions_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "public"."admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
