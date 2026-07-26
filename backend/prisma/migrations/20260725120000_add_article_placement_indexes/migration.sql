CREATE INDEX IF NOT EXISTS "Article_status_deletedAt_showOnHome_publishedAt_idx"
  ON "Article"("status", "deletedAt", "showOnHome", "publishedAt");

CREATE INDEX IF NOT EXISTS "Article_status_deletedAt_showOnHome_showInLatest_publishedAt_idx"
  ON "Article"("status", "deletedAt", "showOnHome", "showInLatest", "publishedAt");

CREATE INDEX IF NOT EXISTS "Article_status_deletedAt_showOnHome_showInSidebar_publishedAt_idx"
  ON "Article"("status", "deletedAt", "showOnHome", "showInSidebar", "publishedAt");

CREATE INDEX IF NOT EXISTS "Article_status_deletedAt_showInSlider_publishedAt_idx"
  ON "Article"("status", "deletedAt", "showInSlider", "publishedAt");

CREATE INDEX IF NOT EXISTS "Article_status_deletedAt_isEditorChoice_publishedAt_idx"
  ON "Article"("status", "deletedAt", "isEditorChoice", "publishedAt");

CREATE INDEX IF NOT EXISTS "Article_status_deletedAt_showInPopular_viewsCount_publishedAt_idx"
  ON "Article"("status", "deletedAt", "showInPopular", "viewsCount", "publishedAt");
