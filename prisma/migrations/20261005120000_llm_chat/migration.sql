CREATE TABLE "ChatMessage" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "readingId" TEXT NOT NULL REFERENCES "Reading"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "role" TEXT NOT NULL CHECK ("role" IN ('user', 'assistant')),
 "content" TEXT NOT NULL,
 "tokens" INTEGER NOT NULL CHECK ("tokens" >= 0),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ChatMessage_readingId_createdAt_idx" ON "ChatMessage"("readingId", "createdAt");
CREATE TABLE "ChatQuota" (
 "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "day" DATE NOT NULL,
 "count" INTEGER NOT NULL DEFAULT 0 CHECK ("count" >= 0),
 PRIMARY KEY ("userId", "day")
);
