-- DESIGN-GAP: Prisma migrate diff rebuilds User/Subscription for SQLite column additions; translate its generated fields/index into additive ALTERs to preserve D1 foreign keys, existing rows and invariant triggers.
ALTER TABLE "User" ADD COLUMN "lifetime" BOOLEAN NOT NULL DEFAULT false CHECK ("lifetime" IN (0,1));
ALTER TABLE "User" ADD COLUMN "revenuecatProUntil" DATETIME;
ALTER TABLE "Subscription" ADD COLUMN "lifetime" BOOLEAN NOT NULL DEFAULT false CHECK ("lifetime" IN (0,1));
ALTER TABLE "Subscription" ADD COLUMN "stripeCheckoutSessionId" TEXT;
CREATE UNIQUE INDEX "Subscription_stripeCheckoutSessionId_key" ON "Subscription"("stripeCheckoutSessionId");
