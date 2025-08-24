-- CreateTable
CREATE TABLE "public"."ScheduledJob" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "executeAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduledJob_status_executeAt_idx" ON "public"."ScheduledJob"("status", "executeAt");

-- CreateIndex
CREATE INDEX "ScheduledJob_type_idx" ON "public"."ScheduledJob"("type");
