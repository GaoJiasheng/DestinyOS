-- Correct SQLite string literals for strict SQLite drivers.
DROP TRIGGER "User_enum_insert";
CREATE TRIGGER "User_enum_insert" BEFORE INSERT ON "User"
WHEN NEW."role" NOT IN ('user','admin') OR NEW."plan" NOT IN ('free','pro') OR NEW."locale" NOT IN ('zh','en','zh-TW') BEGIN SELECT RAISE(ABORT, 'User_enum_check'); END;
DROP TRIGGER "User_enum_update";
CREATE TRIGGER "User_enum_update" BEFORE UPDATE ON "User"
WHEN NEW."role" NOT IN ('user','admin') OR NEW."plan" NOT IN ('free','pro') OR NEW."locale" NOT IN ('zh','en','zh-TW') BEGIN SELECT RAISE(ABORT, 'User_enum_check'); END;
DROP TRIGGER "Reading_enum_insert";
CREATE TRIGGER "Reading_enum_insert" BEFORE INSERT ON "Reading"
WHEN NEW."system" NOT IN ('bazi','ziwei','iching','qimen','tarot','astrology','vedic','numerology','synastry','daily') OR NEW."status" NOT IN ('ok','failed') BEGIN SELECT RAISE(ABORT, 'Reading_enum_check'); END;
DROP TRIGGER "Reading_enum_update";
CREATE TRIGGER "Reading_enum_update" BEFORE UPDATE ON "Reading"
WHEN NEW."system" NOT IN ('bazi','ziwei','iching','qimen','tarot','astrology','vedic','numerology','synastry','daily') OR NEW."status" NOT IN ('ok','failed') BEGIN SELECT RAISE(ABORT, 'Reading_enum_check'); END;
DROP TRIGGER "BirthProfile_enum_insert";
CREATE TRIGGER "BirthProfile_enum_insert" BEFORE INSERT ON "BirthProfile"
WHEN NEW."relation" NOT IN ('self','partner','family','friend','other') OR NEW."gender" NOT IN ('male','female','unspecified') BEGIN SELECT RAISE(ABORT, 'BirthProfile_enum_check'); END;
DROP TRIGGER "BirthProfile_enum_update";
CREATE TRIGGER "BirthProfile_enum_update" BEFORE UPDATE ON "BirthProfile"
WHEN NEW."relation" NOT IN ('self','partner','family','friend','other') OR NEW."gender" NOT IN ('male','female','unspecified') BEGIN SELECT RAISE(ABORT, 'BirthProfile_enum_check'); END;
DROP TRIGGER "KnowledgeUnit_enum_insert";
CREATE TRIGGER "KnowledgeUnit_enum_insert" BEFORE INSERT ON "KnowledgeUnit"
WHEN NEW."system" NOT IN ('bazi','ziwei','iching','qimen','tarot','astrology','vedic','numerology','synastry','daily') OR NEW."status" NOT IN ('draft','published','deprecated') BEGIN SELECT RAISE(ABORT, 'KnowledgeUnit_enum_check'); END;
DROP TRIGGER "KnowledgeUnit_enum_update";
CREATE TRIGGER "KnowledgeUnit_enum_update" BEFORE UPDATE ON "KnowledgeUnit"
WHEN NEW."system" NOT IN ('bazi','ziwei','iching','qimen','tarot','astrology','vedic','numerology','synastry','daily') OR NEW."status" NOT IN ('draft','published','deprecated') BEGIN SELECT RAISE(ABORT, 'KnowledgeUnit_enum_check'); END;
