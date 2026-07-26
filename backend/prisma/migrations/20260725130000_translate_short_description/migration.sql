ALTER TABLE "ArticleTranslation"
  ADD COLUMN IF NOT EXISTS "shortDescription" TEXT;

UPDATE "ArticleTranslation"
SET "shortDescription" = LEFT("summary", 500)
WHERE "status" = 'READY';
