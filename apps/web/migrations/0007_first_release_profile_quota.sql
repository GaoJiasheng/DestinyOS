-- DESIGN-GAP: SQLite triggers cannot read build flags. Keep the hard member ceiling in
-- the database; profile-service enforces the flag-dependent limit inside its atomic batch.
DROP TRIGGER "BirthProfile_quota";
CREATE TRIGGER "BirthProfile_quota" BEFORE INSERT ON "BirthProfile"
WHEN NEW."isCurrent"=1 AND (SELECT count(*) FROM "BirthProfile" WHERE "userId"=NEW."userId" AND "isCurrent"=1) >= 20
BEGIN SELECT RAISE(ABORT, 'profile_limit'); END;
