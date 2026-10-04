# M4 configuration and verification

Requirements are defined only by repository docs/; this is an operator runbook.

- Before launch, set the real `PRIVACY_CONTROLLER_NAME` and `PRIVACY_CONTACT_EMAIL`.
  Vercel production must use Pro. Set log/Sentry retention to 30 days.
- In AdSense, publish Privacy & messaging European regulations message (certified
  CMP, TCF v2.2) and US state regulations message. Enable account RDP and honor GPC.
  Configure the publisher client and five numeric slot IDs in `.env.example`.
  Missing client disables injection; missing slots omit those placements.
  On an EEA/UK/CH test connection verify the CMP appears, reject personalization,
  and reopen choices using footer/settings. Verify GPC in a supported browser.
- Keep CSP Report-Only for at least one week. `/api/v1/csp/report` retains directive
  and blocked-hostname counts only, with no URL paths/queries. Inspect browser console with real ads before enforcing CSP and
  auditing statically generated scripts; violation URLs must not contain PII.
- Set Stripe test secret, run `pnpm stripe:products`, copy returned price IDs.
  Suggested USD prices are 2.99 / 24.99. Optional cents overrides require matching
  display/terms changes before launch. Configure Customer Portal with payment
  methods, monthly/yearly price switching and cancellation at period end.
  Enable receipts/invoices in Stripe. Activate Stripe Tax before setting
  `STRIPE_TAX_ENABLED=true`; leave it false until configured.
- Subscribe webhook endpoint `/api/v1/stripe/webhook` to
  `checkout.session.completed`, `customer.subscription.updated`,
  `customer.subscription.deleted`, `invoice.payment_failed`.
  Set webhook secret independently of API key. For local signed events:
  `stripe listen --forward-to localhost:3000/api/v1/stripe/webhook`.
  API version follows the installed Stripe SDK; period end uses subscription items.
- Configure `CRON_SECRET`. Vercel invokes the authenticated GET route daily at
  03:00 UTC; documented POST is supported too. Account deletion cancels Stripe
  immediately and invalidates sessions/shares, hard deletion follows after 7 days.
- `pnpm test:m4:e2e` uses signed webhook fixtures, isolated PostgreSQL/Redis and a
  process-only Stripe mock. The application contains no test payment bypass.
  Live Stripe/AdSense account settings and EEA VPN verification require configured
  accounts; automated tests do not certify dashboard setup or legal identity.

Audit exceptions (verified by `pnpm security:policy`, never blanket severity ignores):

- CVE-2026-40299: next-intl 3.x uses `localePrefix: always`, not the affected
  `as-needed` redirect flow; middleware also rejects off-origin redirects.
- GHSA-4c35-wcg5-mm9h: experimental catalog precompilation is not enabled;
  our catalog expander independently rejects prototype-related keys.
- CVE-2026-84373: Vitest runs Node tests, no browser mock interceptor/dev server.
- CVE-2026-56876 and CVE-2026-19693: extract-zip has no upstream fixed version;
  the committed pnpm patch bounds symlink targets and uses exclusive file writes.
  Regression tests cover escape links and duplicate symlink/file entries.
  Replace the patch with an upstream fix when available; reassess all exceptions
  if changing locale routing, translation compilation or test browser mode.
- Automatic feedback scrubbing matches emails, dates, phone-like numbers and
  coordinates. Free-text names are not reliably detectable; users can delete
  feedback on account deletion, and admins may remove sensitive feedback text.
