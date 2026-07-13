-- Indexes for the queries that grow with the article, view and moderation tables.
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
CREATE INDEX IF NOT EXISTS "Article_extraCategoryIds_gin_idx"
  ON "Article" USING GIN ("extraCategoryIds");

CREATE INDEX IF NOT EXISTS "RefreshToken_expiresAt_revokedAt_idx"
  ON "RefreshToken"("expiresAt", "revokedAt");
CREATE INDEX IF NOT EXISTS "Article_createdAt_idx"
  ON "Article"("createdAt");
CREATE INDEX IF NOT EXISTS "Article_status_deletedAt_viewsCount_publishedAt_idx"
  ON "Article"("status", "deletedAt", "viewsCount", "publishedAt");
CREATE INDEX IF NOT EXISTS "MediaFile_createdAt_idx"
  ON "MediaFile"("createdAt");
CREATE INDEX IF NOT EXISTS "Comment_articleId_status_createdAt_idx"
  ON "Comment"("articleId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "Comment_status_createdAt_idx"
  ON "Comment"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx"
  ON "AuditLog"("createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_entity_createdAt_idx"
  ON "AuditLog"("entity", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_action_createdAt_idx"
  ON "AuditLog"("action", "createdAt");
CREATE INDEX IF NOT EXISTS "ArticleView_createdAt_articleId_idx"
  ON "ArticleView"("createdAt", "articleId");
CREATE INDEX IF NOT EXISTS "ArticleView_articleId_ipHash_createdAt_idx"
  ON "ArticleView"("articleId", "ipHash", "createdAt");
