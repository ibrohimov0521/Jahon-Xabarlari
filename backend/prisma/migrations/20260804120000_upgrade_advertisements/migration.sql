ALTER TABLE "Advertisement"
  ADD COLUMN "altText" TEXT,
  ADD COLUMN "sponsorName" TEXT,
  ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "showOnMobile" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "showOnDesktop" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "startAt" TIMESTAMP(3),
  ADD COLUMN "endAt" TIMESTAMP(3),
  ADD COLUMN "impressions" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "clicks" INTEGER NOT NULL DEFAULT 0;

DROP INDEX IF EXISTS "Advertisement_title_key";

CREATE INDEX "Advertisement_status_placement_priority_updatedAt_idx"
  ON "Advertisement"("status", "placement", "priority", "updatedAt");

CREATE INDEX "Advertisement_status_startAt_endAt_idx"
  ON "Advertisement"("status", "startAt", "endAt");

UPDATE "Advertisement"
SET "placement" = CASE LOWER("placement")
  WHEN 'header' THEN 'HOME_BANNER'
  WHEN 'sidebar' THEN 'HOME_SIDEBAR'
  WHEN 'home' THEN 'HOME_FEED'
  WHEN 'article' THEN 'ARTICLE_INLINE'
  ELSE "placement"
END;
