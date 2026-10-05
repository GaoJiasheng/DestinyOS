ALTER TYPE "System" ADD VALUE IF NOT EXISTS 'synastry';
CREATE TYPE "ProfileRelation" AS ENUM ('self', 'partner', 'family', 'friend', 'other');
ALTER TABLE "BirthProfile" ADD COLUMN "label" TEXT, ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "relation" "ProfileRelation" NOT NULL DEFAULT 'self';
DROP INDEX "BirthProfile_userId_version_key";
UPDATE "BirthProfile" SET "isDefault" = true WHERE "isCurrent" = true;
CREATE INDEX "BirthProfile_userId_isDefault_idx" ON "BirthProfile"("userId", "isDefault");
-- DESIGN-GAP: Exactly one default among live profiles is protected by a partial unique index and owner-row locks.
CREATE UNIQUE INDEX "BirthProfile_one_default" ON "BirthProfile"("userId") WHERE "isDefault" = true AND "isCurrent" = true;
ALTER TABLE "Reading" ADD COLUMN "partnerProfileId" TEXT;
CREATE INDEX "Reading_partnerProfileId_idx" ON "Reading"("partnerProfileId");
ALTER TABLE "Reading" ADD CONSTRAINT "Reading_partnerProfileId_fkey" FOREIGN KEY ("partnerProfileId") REFERENCES "BirthProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Legacy version rows belong to the original live profile; report snapshots remain immutable.
UPDATE "Reading" r SET "profileId" = live."id" FROM "BirthProfile" old, "BirthProfile" live WHERE r."profileId" = old."id" AND old."isCurrent" = false AND live."userId" = old."userId" AND live."isCurrent" = true;
