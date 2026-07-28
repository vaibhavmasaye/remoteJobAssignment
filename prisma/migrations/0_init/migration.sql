-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('HUBSPOT', 'STRIPE', 'GOOGLE_CALENDAR');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('ACTIVE', 'DEGRADED', 'DISABLED', 'AUTH_REQUIRED');

-- CreateEnum
CREATE TYPE "SyncTriggerType" AS ENUM ('MANUAL', 'SCHEDULED', 'WEBHOOK', 'RECOVERY');

-- CreateEnum
CREATE TYPE "SyncRunStatus" AS ENUM ('RUNNING', 'PARTIAL_SUCCESS', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "SourceRunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED', 'SKIPPED', 'FALLBACK_FULL');

-- CreateEnum
CREATE TYPE "SyncMode" AS ENUM ('INCREMENTAL', 'FULL', 'WEBHOOK_RECONCILE');

-- CreateEnum
CREATE TYPE "NormalizedType" AS ENUM ('PERSON', 'PAYMENT', 'CALENDAR_EVENT');

-- CreateEnum
CREATE TYPE "WebhookEventStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'FAILED', 'IGNORED');

-- CreateEnum
CREATE TYPE "FailureStage" AS ENUM ('FETCH', 'VALIDATE', 'NORMALIZE', 'WRITE');

-- CreateTable SourceConnection
CREATE TABLE "SourceConnection" (
    "id" TEXT NOT NULL,
    "source" "SourceType" NOT NULL,
    "accountExternalId" TEXT,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "encryptedCredentials" JSONB,
    "lastSuccessAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SourceConnection_source_accountExternalId_key" ON "SourceConnection"("source", "accountExternalId");

-- CreateIndex
CREATE INDEX "SourceConnection_status_idx" ON "SourceConnection"("status");

-- CreateIndex
CREATE INDEX "SourceConnection_lastErrorAt_idx" ON "SourceConnection"("lastErrorAt");

-- CreateTable SyncCheckpoint
CREATE TABLE "SyncCheckpoint" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "objectType" TEXT NOT NULL,
    "cursor" TEXT,
    "watermark" TIMESTAMP(3),
    "cursorVersion" INTEGER NOT NULL DEFAULT 1,
    "lastFullSyncAt" TIMESTAMP(3),
    "lastIncrementalSyncAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncCheckpoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SyncCheckpoint_connectionId_objectType_key" ON "SyncCheckpoint"("connectionId", "objectType");

-- CreateIndex
CREATE INDEX "SyncCheckpoint_connectionId_idx" ON "SyncCheckpoint"("connectionId");

-- CreateIndex
CREATE INDEX "SyncCheckpoint_updatedAt_idx" ON "SyncCheckpoint"("updatedAt");

-- CreateTable SyncRun
CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "triggerType" "SyncTriggerType" NOT NULL,
    "status" "SyncRunStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "requestedBy" TEXT,
    "summary" JSONB,

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SyncRun_correlationId_key" ON "SyncRun"("correlationId");

-- CreateIndex
CREATE INDEX "SyncRun_status_idx" ON "SyncRun"("status");

-- CreateIndex
CREATE INDEX "SyncRun_startedAt_idx" ON "SyncRun"("startedAt");

-- CreateIndex
CREATE INDEX "SyncRun_finishedAt_idx" ON "SyncRun"("finishedAt");

-- CreateTable SourceSyncRun
CREATE TABLE "SourceSyncRun" (
    "id" TEXT NOT NULL,
    "syncRunId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "source" "SourceType" NOT NULL,
    "mode" "SyncMode" NOT NULL DEFAULT 'INCREMENTAL',
    "status" "SourceRunStatus" NOT NULL,
    "recordsSeen" INTEGER NOT NULL DEFAULT 0,
    "recordsWritten" INTEGER NOT NULL DEFAULT 0,
    "recordsSkipped" INTEGER NOT NULL DEFAULT 0,
    "recordsFailed" INTEGER NOT NULL DEFAULT 0,
    "cursorBefore" TEXT,
    "cursorAfter" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "SourceSyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SourceSyncRun_syncRunId_idx" ON "SourceSyncRun"("syncRunId");

-- CreateIndex
CREATE INDEX "SourceSyncRun_connectionId_idx" ON "SourceSyncRun"("connectionId");

-- CreateIndex
CREATE INDEX "SourceSyncRun_status_idx" ON "SourceSyncRun"("status");

-- CreateIndex
CREATE INDEX "SourceSyncRun_startedAt_idx" ON "SourceSyncRun"("startedAt");

-- CreateTable ExternalRecord
CREATE TABLE "ExternalRecord" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "source" "SourceType" NOT NULL,
    "externalObjectType" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "externalVersion" TEXT,
    "sourceUpdatedAt" TIMESTAMP(3),
    "normalizedType" "NormalizedType" NOT NULL,
    "normalizedId" TEXT NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "rawPayload" JSONB,
    "payloadHash" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExternalRecord_connectionId_externalObjectType_externalId_key" ON "ExternalRecord"("connectionId", "externalObjectType", "externalId");

-- CreateIndex
CREATE INDEX "ExternalRecord_normalizedType_idx" ON "ExternalRecord"("normalizedType");

-- CreateIndex
CREATE INDEX "ExternalRecord_normalizedId_idx" ON "ExternalRecord"("normalizedId");

-- CreateIndex
CREATE INDEX "ExternalRecord_isDeleted_idx" ON "ExternalRecord"("isDeleted");

-- CreateIndex
CREATE INDEX "ExternalRecord_sourceUpdatedAt_idx" ON "ExternalRecord"("sourceUpdatedAt");

-- CreateTable Person
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "fullName" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "companyName" TEXT,
    "status" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Person_email_idx" ON "Person"("email");

-- CreateIndex
CREATE INDEX "Person_createdAt_idx" ON "Person"("createdAt");

-- CreateTable Payment
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "customerExternalId" TEXT,
    "amountMinor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" TEXT NOT NULL,
    "paymentMethodType" TEXT,
    "paidAt" TIMESTAMP(3),
    "refundedAmountMinor" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_paidAt_idx" ON "Payment"("paidAt");

-- CreateIndex
CREATE INDEX "Payment_customerExternalId_idx" ON "Payment"("customerExternalId");

-- CreateIndex
CREATE INDEX "Payment_createdAt_idx" ON "Payment"("createdAt");

-- CreateTable CalendarEvent
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "calendarExternalId" TEXT NOT NULL,
    "summary" TEXT,
    "description" TEXT,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "isAllDay" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT,
    "status" TEXT NOT NULL,
    "organizerEmail" TEXT,
    "attendees" JSONB,
    "recurringEventExternalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CalendarEvent_status_idx" ON "CalendarEvent"("status");

-- CreateIndex
CREATE INDEX "CalendarEvent_startAt_idx" ON "CalendarEvent"("startAt");

-- CreateIndex
CREATE INDEX "CalendarEvent_calendarExternalId_idx" ON "CalendarEvent"("calendarExternalId");

-- CreateIndex
CREATE INDEX "CalendarEvent_createdAt_idx" ON "CalendarEvent"("createdAt");

-- CreateTable ProcessedWebhookEvent
CREATE TABLE "ProcessedWebhookEvent" (
    "id" TEXT NOT NULL,
    "source" "SourceType" NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "status" "WebhookEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,

    CONSTRAINT "ProcessedWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedWebhookEvent_source_externalEventId_key" ON "ProcessedWebhookEvent"("source", "externalEventId");

-- CreateIndex
CREATE INDEX "ProcessedWebhookEvent_status_idx" ON "ProcessedWebhookEvent"("status");

-- CreateIndex
CREATE INDEX "ProcessedWebhookEvent_receivedAt_idx" ON "ProcessedWebhookEvent"("receivedAt");

-- CreateTable FailedRecord
CREATE TABLE "FailedRecord" (
    "id" TEXT NOT NULL,
    "sourceSyncRunId" TEXT,
    "connectionId" TEXT NOT NULL,
    "source" "SourceType" NOT NULL,
    "externalObjectType" TEXT,
    "externalId" TEXT,
    "stage" "FailureStage" NOT NULL,
    "errorCode" TEXT NOT NULL,
    "errorMessage" TEXT NOT NULL,
    "rawPayload" JSONB,
    "retryable" BOOLEAN NOT NULL DEFAULT true,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "FailedRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FailedRecord_retryable_idx" ON "FailedRecord"("retryable");

-- CreateIndex
CREATE INDEX "FailedRecord_nextRetryAt_idx" ON "FailedRecord"("nextRetryAt");

-- CreateIndex
CREATE INDEX "FailedRecord_createdAt_idx" ON "FailedRecord"("createdAt");

-- CreateIndex
CREATE INDEX "FailedRecord_resolvedAt_idx" ON "FailedRecord"("resolvedAt");

-- CreateIndex
CREATE INDEX "FailedRecord_source_idx" ON "FailedRecord"("source");

-- AddForeignKey
ALTER TABLE "SyncCheckpoint" ADD CONSTRAINT "SyncCheckpoint_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "SourceConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceSyncRun" ADD CONSTRAINT "SourceSyncRun_syncRunId_fkey" FOREIGN KEY ("syncRunId") REFERENCES "SyncRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceSyncRun" ADD CONSTRAINT "SourceSyncRun_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "SourceConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalRecord" ADD CONSTRAINT "ExternalRecord_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "SourceConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FailedRecord" ADD CONSTRAINT "FailedRecord_sourceSyncRunId_fkey" FOREIGN KEY ("sourceSyncRunId") REFERENCES "SourceSyncRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FailedRecord" ADD CONSTRAINT "FailedRecord_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "SourceConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
