CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Article_content_trgm_idx"
ON "Article" USING GIN ("content" gin_trgm_ops);
