-- DESIGN-GAP: Native preferences are additive to Web settings, including the App-only vedic theme.
ALTER TABLE "User" ADD COLUMN "mobileSettings" JSON;
-- DESIGN-GAP: Mobile credentials have no relationship to Auth.js Cookie sessions.
CREATE TABLE "MobileSession" (
 "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
 "accessTokenHash" TEXT NOT NULL UNIQUE, "refreshTokenHash" TEXT NOT NULL UNIQUE,
 "accessExpiresAt" DATETIME NOT NULL, "refreshExpiresAt" DATETIME NOT NULL,
 "deviceName" TEXT NOT NULL, "platform" TEXT NOT NULL CHECK(platform IN ('ios','android')),
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "lastUsedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "rotation" INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX "MobileSession_userId_idx" ON "MobileSession"("userId");
ALTER TABLE "Reading" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT '1970-01-01T00:00:00.000+00:00';
UPDATE "Reading" SET "updatedAt"="createdAt";
ALTER TABLE "JournalEntry" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT '1970-01-01T00:00:00.000+00:00';
UPDATE "JournalEntry" SET "updatedAt"="createdAt";
-- DESIGN-GAP: Retain tombstones until account deletion; stale offline devices cannot silently miss removals.
CREATE TABLE "MobileSyncChange" (
 "sequence" INTEGER PRIMARY KEY AUTOINCREMENT, "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
 "resource" TEXT NOT NULL CHECK(resource IN ('profiles','readings','journal','settings')),
 "recordId" TEXT NOT NULL, "deleted" BOOLEAN NOT NULL, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "MobileSyncChange_userId_resource_sequence_idx" ON "MobileSyncChange"("userId","resource","sequence");
CREATE TRIGGER "mobile_profiles_insert" AFTER INSERT ON "BirthProfile"
BEGIN
 INSERT INTO "MobileSyncChange" ("userId","resource","recordId","deleted","updatedAt") VALUES (NEW."userId",'profiles',NEW."id",CASE WHEN NEW."isCurrent"=1 THEN 0 ELSE 1 END,strftime('%Y-%m-%dT%H:%M:%f+00:00','now'));
END;
CREATE TRIGGER "mobile_profiles_update" AFTER UPDATE ON "BirthProfile"
BEGIN
 INSERT INTO "MobileSyncChange" ("userId","resource","recordId","deleted","updatedAt") VALUES (NEW."userId",'profiles',NEW."id",CASE WHEN NEW."isCurrent"=1 THEN 0 ELSE 1 END,strftime('%Y-%m-%dT%H:%M:%f+00:00','now'));
END;
CREATE TRIGGER "mobile_profiles_delete" AFTER DELETE ON "BirthProfile" WHEN EXISTS (SELECT 1 FROM "User" WHERE id=OLD."userId")
BEGIN
 INSERT INTO "MobileSyncChange" ("userId","resource","recordId","deleted","updatedAt") VALUES (OLD."userId",'profiles',OLD."id",1,strftime('%Y-%m-%dT%H:%M:%f+00:00','now'));
END;
INSERT INTO "MobileSyncChange" ("userId","resource","recordId","deleted","updatedAt") SELECT "userId",'profiles',"id",CASE WHEN "isCurrent"=1 THEN 0 ELSE 1 END,"updatedAt" FROM "BirthProfile" WHERE "userId" IS NOT NULL;
CREATE TRIGGER "mobile_readings_insert" AFTER INSERT ON "Reading" WHEN NEW."userId" IS NOT NULL
BEGIN
 INSERT INTO "MobileSyncChange" ("userId","resource","recordId","deleted","updatedAt") VALUES (NEW."userId",'readings',NEW."id",0,strftime('%Y-%m-%dT%H:%M:%f+00:00','now'));
END;
CREATE TRIGGER "mobile_readings_update" AFTER UPDATE ON "Reading" WHEN NEW."userId" IS NOT NULL
BEGIN
 INSERT INTO "MobileSyncChange" ("userId","resource","recordId","deleted","updatedAt") VALUES (NEW."userId",'readings',NEW."id",0,strftime('%Y-%m-%dT%H:%M:%f+00:00','now'));
END;
CREATE TRIGGER "mobile_readings_delete" AFTER DELETE ON "Reading" WHEN OLD."userId" IS NOT NULL AND EXISTS (SELECT 1 FROM "User" WHERE id=OLD."userId")
BEGIN
 INSERT INTO "MobileSyncChange" ("userId","resource","recordId","deleted","updatedAt") VALUES (OLD."userId",'readings',OLD."id",1,strftime('%Y-%m-%dT%H:%M:%f+00:00','now'));
END;
INSERT INTO "MobileSyncChange" ("userId","resource","recordId","deleted","updatedAt") SELECT "userId",'readings',"id",0,"updatedAt" FROM "Reading" WHERE "userId" IS NOT NULL;
CREATE TRIGGER "mobile_journal_insert" AFTER INSERT ON "JournalEntry"
BEGIN
 INSERT INTO "MobileSyncChange" ("userId","resource","recordId","deleted","updatedAt") VALUES (NEW."userId",'journal',NEW."id",0,strftime('%Y-%m-%dT%H:%M:%f+00:00','now'));
END;
CREATE TRIGGER "mobile_journal_update" AFTER UPDATE ON "JournalEntry"
BEGIN
 INSERT INTO "MobileSyncChange" ("userId","resource","recordId","deleted","updatedAt") VALUES (NEW."userId",'journal',NEW."id",0,strftime('%Y-%m-%dT%H:%M:%f+00:00','now'));
END;
CREATE TRIGGER "mobile_journal_delete" AFTER DELETE ON "JournalEntry" WHEN EXISTS (SELECT 1 FROM "User" WHERE id=OLD."userId")
BEGIN
 INSERT INTO "MobileSyncChange" ("userId","resource","recordId","deleted","updatedAt") VALUES (OLD."userId",'journal',OLD."id",1,strftime('%Y-%m-%dT%H:%M:%f+00:00','now'));
END;
INSERT INTO "MobileSyncChange" ("userId","resource","recordId","deleted","updatedAt") SELECT "userId",'journal',"id",0,"updatedAt" FROM "JournalEntry" WHERE "userId" IS NOT NULL;
CREATE TRIGGER "mobile_settings_insert" AFTER INSERT ON "User"
BEGIN
 INSERT INTO "MobileSyncChange" ("userId","resource","recordId","deleted","updatedAt") VALUES (NEW."id",'settings',NEW."id",0,strftime('%Y-%m-%dT%H:%M:%f+00:00','now'));
END;
CREATE TRIGGER "mobile_settings_update" AFTER UPDATE ON "User" WHEN OLD."locale" IS NOT NEW."locale" OR OLD."theme" IS NOT NEW."theme" OR OLD."soundOn" IS NOT NEW."soundOn" OR OLD."reducedMotion" IS NOT NEW."reducedMotion" OR OLD."tz" IS NOT NEW."tz" OR OLD."name" IS NOT NEW."name" OR OLD."disclaimerAcceptedAt" IS NOT NEW."disclaimerAcceptedAt" OR OLD."mobileSettings" IS NOT NEW."mobileSettings"
BEGIN
 INSERT INTO "MobileSyncChange" ("userId","resource","recordId","deleted","updatedAt") VALUES (NEW."id",'settings',NEW."id",0,strftime('%Y-%m-%dT%H:%M:%f+00:00','now'));
END;
INSERT INTO "MobileSyncChange" ("userId","resource","recordId","deleted","updatedAt") SELECT "id",'settings',"id",0,"updatedAt" FROM "User" WHERE "id" IS NOT NULL;
