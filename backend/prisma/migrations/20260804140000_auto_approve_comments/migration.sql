ALTER TABLE "Comment" ALTER COLUMN "status" SET DEFAULT 'APPROVED';

UPDATE "Comment"
SET "status" = 'APPROVED'
WHERE "status" = 'PENDING';
