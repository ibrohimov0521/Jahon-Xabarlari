CREATE INDEX IF NOT EXISTS "Comment_name_trgm_idx"
ON "Comment" USING GIN ("name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Comment_body_trgm_idx"
ON "Comment" USING GIN ("body" gin_trgm_ops);
