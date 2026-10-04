ALTER TABLE "Session" ADD COLUMN "authenticatedAt" TIMESTAMP(3) NOT NULL DEFAULT '1970-01-01';
ALTER TABLE "Session" ALTER COLUMN "authenticatedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "User" ADD COLUMN "lastActiveAt" TIMESTAMP(3);
ALTER TABLE "Feedback" ADD COLUMN "processedAt" TIMESTAMP(3);
ALTER TABLE "KnowledgeRelease" ADD COLUMN "bundles" JSONB;
CREATE TABLE "EventDaily" (
 "id" TEXT PRIMARY KEY, "day" DATE NOT NULL, "name" TEXT NOT NULL,
 "system" "System", "locale" "Locale", "plan" "Plan", "count" INTEGER NOT NULL, "uniques" INTEGER NOT NULL
);
CREATE INDEX "EventDaily_day_name_idx" ON "EventDaily"("day", "name");
