-- Aligns the migration history with the current Prisma schema. The original baseline
-- predated aggregator sources, subscribers, and source attribution fields on articles.

-- CreateTable
CREATE TABLE "AggregatorSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "feedUrl" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AggregatorSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscriber" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subscriber_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Article" ADD COLUMN "sourceName" TEXT;
ALTER TABLE "Article" ADD COLUMN "sourceUrl" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "AggregatorSource_feedUrl_key" ON "AggregatorSource"("feedUrl");

-- CreateIndex
CREATE UNIQUE INDEX "Subscriber_email_key" ON "Subscriber"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Article_sourceUrl_key" ON "Article"("sourceUrl");
