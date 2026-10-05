-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "mood" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "prediction" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JournalEntry_userId_profileId_date_idx" ON "JournalEntry"("userId", "profileId", "date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_profileId_date_key" ON "JournalEntry"("profileId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "BirthProfile_id_userId_key" ON "BirthProfile"("id", "userId");

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_profileId_userId_fkey" FOREIGN KEY ("profileId", "userId") REFERENCES "BirthProfile"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- DESIGN-GAP: Database constraints enforce the 1–5 mood range and encrypted envelope even outside application writes.
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_mood_check" CHECK ("mood" BETWEEN 1 AND 5);
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_text_encrypted_check" CHECK ("text" ~ '^v[1-9][0-9]*:[A-Za-z0-9+/]+={0,2}:[A-Za-z0-9+/]+={0,2}:[A-Za-z0-9+/]*={0,2}$');
