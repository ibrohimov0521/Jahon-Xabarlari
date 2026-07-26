UPDATE "Article"
SET
  "gallery" = COALESCE("gallery", ARRAY[]::TEXT[]),
  "extraCategoryIds" = COALESCE("extraCategoryIds", ARRAY[]::TEXT[]);

ALTER TABLE "Article"
  ALTER COLUMN "gallery" SET DEFAULT ARRAY[]::TEXT[],
  ALTER COLUMN "gallery" SET NOT NULL,
  ALTER COLUMN "extraCategoryIds" SET DEFAULT ARRAY[]::TEXT[],
  ALTER COLUMN "extraCategoryIds" SET NOT NULL;
