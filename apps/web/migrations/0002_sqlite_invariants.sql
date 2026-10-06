-- DESIGN-GAP: Guard checks and legacy PostgreSQL constraints are explicit D1 SQL, outside Prisma's schema language.
DROP TABLE "BatchGuard";
CREATE TABLE "BatchGuard" (id TEXT PRIMARY KEY NOT NULL, ok INTEGER NOT NULL CHECK (ok=1));
CREATE UNIQUE INDEX "BirthProfile_one_default" ON "BirthProfile"("userId") WHERE "isDefault"=1 AND "isCurrent"=1;
CREATE TRIGGER "BirthProfile_quota" BEFORE INSERT ON "BirthProfile"
WHEN NEW."isCurrent"=1 AND (SELECT count(*) FROM "BirthProfile" WHERE "userId"=NEW."userId" AND "isCurrent"=1) >= (SELECT CASE WHEN plan='pro' THEN 20 ELSE 3 END FROM "User" WHERE id=NEW."userId")
BEGIN SELECT RAISE(ABORT, 'profile_limit'); END;
CREATE TRIGGER "JournalEntry_valid_insert" BEFORE INSERT ON "JournalEntry"
WHEN NEW.text NOT GLOB 'v[1-9]*:*:*:*' OR NEW.mood NOT BETWEEN 1 AND 5 BEGIN SELECT RAISE(ABORT, 'JournalEntry_check'); END;
CREATE TRIGGER "JournalEntry_valid_update" BEFORE UPDATE OF text,mood ON "JournalEntry"
WHEN NEW.text NOT GLOB 'v[1-9]*:*:*:*' OR NEW.mood NOT BETWEEN 1 AND 5 BEGIN SELECT RAISE(ABORT, 'JournalEntry_check'); END;
CREATE TRIGGER "ChatMessage_valid" BEFORE INSERT ON "ChatMessage"
WHEN NEW.role NOT IN ('user','assistant') OR NEW.tokens<0 BEGIN SELECT RAISE(ABORT, 'ChatMessage_check'); END;
CREATE TRIGGER "ChatQuota_valid_insert" BEFORE INSERT ON "ChatQuota"
WHEN NEW.count<0 BEGIN SELECT RAISE(ABORT, 'ChatQuota_check'); END;
CREATE TRIGGER "ChatQuota_valid_update" BEFORE UPDATE OF count ON "ChatQuota"
WHEN NEW.count<0 BEGIN SELECT RAISE(ABORT, 'ChatQuota_check'); END;
CREATE TRIGGER "User_enum_insert" BEFORE INSERT ON "User"
WHEN NEW."role" NOT IN ('user','admin') OR NEW."plan" NOT IN ('free','pro') OR NEW."locale" NOT IN ('zh','en','zh-TW') BEGIN SELECT RAISE(ABORT, "User_enum_check"); END;
CREATE TRIGGER "User_enum_update" BEFORE UPDATE ON "User"
WHEN NEW."role" NOT IN ('user','admin') OR NEW."plan" NOT IN ('free','pro') OR NEW."locale" NOT IN ('zh','en','zh-TW') BEGIN SELECT RAISE(ABORT, "User_enum_check"); END;
CREATE TRIGGER "Reading_enum_insert" BEFORE INSERT ON "Reading"
WHEN NEW."system" NOT IN ('bazi','ziwei','iching','qimen','tarot','astrology','vedic','numerology','synastry','daily') OR NEW."status" NOT IN ('ok','failed') BEGIN SELECT RAISE(ABORT, "Reading_enum_check"); END;
CREATE TRIGGER "Reading_enum_update" BEFORE UPDATE ON "Reading"
WHEN NEW."system" NOT IN ('bazi','ziwei','iching','qimen','tarot','astrology','vedic','numerology','synastry','daily') OR NEW."status" NOT IN ('ok','failed') BEGIN SELECT RAISE(ABORT, "Reading_enum_check"); END;
CREATE TRIGGER "BirthProfile_enum_insert" BEFORE INSERT ON "BirthProfile"
WHEN NEW."relation" NOT IN ('self','partner','family','friend','other') OR NEW."gender" NOT IN ('male','female','unspecified') BEGIN SELECT RAISE(ABORT, "BirthProfile_enum_check"); END;
CREATE TRIGGER "BirthProfile_enum_update" BEFORE UPDATE ON "BirthProfile"
WHEN NEW."relation" NOT IN ('self','partner','family','friend','other') OR NEW."gender" NOT IN ('male','female','unspecified') BEGIN SELECT RAISE(ABORT, "BirthProfile_enum_check"); END;
CREATE TRIGGER "KnowledgeUnit_enum_insert" BEFORE INSERT ON "KnowledgeUnit"
WHEN NEW."system" NOT IN ('bazi','ziwei','iching','qimen','tarot','astrology','vedic','numerology','synastry','daily') OR NEW."status" NOT IN ('draft','published','deprecated') BEGIN SELECT RAISE(ABORT, "KnowledgeUnit_enum_check"); END;
CREATE TRIGGER "KnowledgeUnit_enum_update" BEFORE UPDATE ON "KnowledgeUnit"
WHEN NEW."system" NOT IN ('bazi','ziwei','iching','qimen','tarot','astrology','vedic','numerology','synastry','daily') OR NEW."status" NOT IN ('draft','published','deprecated') BEGIN SELECT RAISE(ABORT, "KnowledgeUnit_enum_check"); END;
