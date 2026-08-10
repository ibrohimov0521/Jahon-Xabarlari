CREATE TYPE "InstagramFormat" AS ENUM ('POST', 'REEL');

ALTER TABLE "Article"
  ADD COLUMN "instagramEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "instagramFormat" "InstagramFormat",
  ADD COLUMN "instagramSentAt" TIMESTAMP(3),
  ADD COLUMN "instagramMediaId" TEXT,
  ADD COLUMN "instagramUrl" TEXT,
  ADD COLUMN "instagramError" TEXT;

CREATE INDEX "Article_status_deletedAt_instagramEnabled_instagramSentAt_idx"
  ON "Article"("status", "deletedAt", "instagramEnabled", "instagramSentAt");
