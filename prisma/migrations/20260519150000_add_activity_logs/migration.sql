-- CreateEnum
CREATE TYPE "ActivityDomain" AS ENUM ('DOCUMENT', 'JOB', 'EMBEDDING');

-- CreateEnum
CREATE TYPE "ActivityAction" AS ENUM ('CREATED', 'UPDATED', 'DELETED', 'STATUS_CHANGED', 'STAGE_CHANGED', 'BATCH_COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "domain" "ActivityDomain" NOT NULL,
    "entityId" VARCHAR(64) NOT NULL,
    "action" "ActivityAction" NOT NULL,
    "message" VARCHAR(512),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activity_logs_userId_createdAt_idx" ON "activity_logs"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "activity_logs_domain_entityId_idx" ON "activity_logs"("domain", "entityId");
