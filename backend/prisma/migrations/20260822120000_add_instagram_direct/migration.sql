-- CreateEnum
CREATE TYPE "InstagramDirectThreadStatus" AS ENUM ('OPEN', 'NEEDS_REVIEW', 'AUTO_REPLIED', 'CLOSED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "InstagramDirectMessageDirection" AS ENUM ('INBOUND', 'OUTBOUND', 'AI_DRAFT', 'SYSTEM');

-- CreateTable
CREATE TABLE "InstagramDirectThread" (
    "id" TEXT NOT NULL,
    "instagramUserId" TEXT NOT NULL,
    "username" TEXT,
    "status" "InstagramDirectThreadStatus" NOT NULL DEFAULT 'OPEN',
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstagramDirectThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstagramDirectMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "externalId" TEXT,
    "direction" "InstagramDirectMessageDirection" NOT NULL,
    "text" TEXT NOT NULL,
    "aiDraft" TEXT,
    "rawPayload" JSONB,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstagramDirectMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InstagramDirectThread_instagramUserId_key" ON "InstagramDirectThread"("instagramUserId");

-- CreateIndex
CREATE INDEX "InstagramDirectThread_status_lastMessageAt_idx" ON "InstagramDirectThread"("status", "lastMessageAt");

-- CreateIndex
CREATE INDEX "InstagramDirectThread_lastMessageAt_idx" ON "InstagramDirectThread"("lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "InstagramDirectMessage_externalId_key" ON "InstagramDirectMessage"("externalId");

-- CreateIndex
CREATE INDEX "InstagramDirectMessage_threadId_createdAt_idx" ON "InstagramDirectMessage"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "InstagramDirectMessage_direction_createdAt_idx" ON "InstagramDirectMessage"("direction", "createdAt");

-- AddForeignKey
ALTER TABLE "InstagramDirectMessage" ADD CONSTRAINT "InstagramDirectMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "InstagramDirectThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
