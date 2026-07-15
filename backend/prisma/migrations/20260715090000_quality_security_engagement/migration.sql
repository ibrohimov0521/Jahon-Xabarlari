ALTER TABLE "User"
  ADD COLUMN "twoFactorSecret" TEXT,
  ADD COLUMN "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "twoFactorRecoveryHashes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TYPE "ArticleReportStatus" AS ENUM ('PENDING', 'RESOLVED', 'DISMISSED');
CREATE TYPE "ArticleReportReason" AS ENUM ('FACT_ERROR', 'TYPO', 'COPYRIGHT', 'INAPPROPRIATE', 'OTHER');

CREATE TABLE "ArticleReport" (
  "id" TEXT NOT NULL,
  "articleId" TEXT NOT NULL,
  "reason" "ArticleReportReason" NOT NULL,
  "details" TEXT NOT NULL,
  "email" TEXT,
  "ipHash" TEXT,
  "status" "ArticleReportStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ArticleReport_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ArticleReport"
  ADD CONSTRAINT "ArticleReport_articleId_fkey"
  FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "ArticleReport_articleId_status_createdAt_idx" ON "ArticleReport"("articleId", "status", "createdAt");
CREATE INDEX "ArticleReport_status_createdAt_idx" ON "ArticleReport"("status", "createdAt");
CREATE INDEX "ArticleTag_tagId_idx" ON "ArticleTag"("tagId");
