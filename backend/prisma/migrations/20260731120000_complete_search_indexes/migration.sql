CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Article_title_trgm_idx"
ON "Article" USING GIN ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Article_summary_trgm_idx"
ON "Article" USING GIN ("summary" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "ArticleTranslation_title_trgm_idx"
ON "ArticleTranslation" USING GIN ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "ArticleTranslation_summary_trgm_idx"
ON "ArticleTranslation" USING GIN ("summary" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "ArticleTranslation_content_trgm_idx"
ON "ArticleTranslation" USING GIN ("content" gin_trgm_ops);
