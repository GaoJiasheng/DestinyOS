-- B-04 web push subscriptions. Endpoint and keys are application-encrypted; endpointHash de-duplicates.
CREATE TABLE "PushSubscription" (
 "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
 "endpointHash" TEXT NOT NULL UNIQUE CHECK(length("endpointHash")=64),
 "encEndpoint" TEXT NOT NULL, "encKeys" TEXT NOT NULL,
 "locale" TEXT NOT NULL CHECK("locale" IN ('zh','zh-TW','en')),
 "tz" TEXT NOT NULL CHECK(length("tz") BETWEEN 1 AND 64),
 "hour" INTEGER NOT NULL DEFAULT 8 CHECK("hour" BETWEEN 0 AND 23),
 "lastSentDate" TEXT, "failureCount" INTEGER NOT NULL DEFAULT 0, "disabledAt" DATETIME,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");
CREATE INDEX "PushSubscription_disabledAt_hour_idx" ON "PushSubscription"("disabledAt","hour");
