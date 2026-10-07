# DestinyOS mobile

Expo SDK 57 / Expo Router / React Native new architecture / strict TypeScript.

Run commands from the repository root:

```sh
pnpm install
pnpm --filter @tianji/mobile dev
pnpm --filter @tianji/mobile ios
pnpm --filter @tianji/mobile test
pnpm --filter @tianji/mobile prebuild:android
```

The native package and bundle identifier are `pub.gavin.tianji`. Continuous Native
Generation recreates ignored `ios/` and `android/` projects from `app.config.ts`;
WidgetKit and Android widgets live under `native/`. No Android native build is
required until Owner enables the Java toolchain.

The App imports Web's compiled flat `messages/{zh,zh-TW,en}.json` catalogs directly.
Run `pnpm content:build` after changing source copy. `i18next-icu` preserves Web ICU
formatting. The M01 shell uses i18next; M02 diagnostics use next-intl's native-compatible
ICU translator, with the same bilingual catalogs as Web.
All local profiles, reports, journal entries and settings now use SQLCipher. AsyncStorage is
read only to migrate M01 theme/language preferences once; it never receives private data.

`packages/ui-core/tokens` is the canonical DOM-free design token source. Its build
regenerates the stylesheet imported by Web. Fonts use the same OFL sources, renamed
and subsetted for the native shell and effect labels; run `pnpm mobile:fonts` with fonttools installed
to rebuild them. All three locales are checked for Chinese shell glyph coverage.

Run the native smoke flow from the root with an installed app build:

```sh
pnpm --filter @tianji/mobile test:e2e --device <simulator-uuid>
```

Screenshots live under `apps/mobile/test-results/M01/`. M02 adds Hermes fixtures and
Skia effects; M05 adds full onboarding and the ask sheet. The M01 ask tab is an empty
route scaffold. EAS account/project linking and store submission are owned by M15.

M02 diagnostics: open `tianji:///dev/effects` in the installed app. The page runs production
Fixture A compute + bilingual interpret and uncached computeDaily, and switches six native
scenes. `bash apps/mobile/scripts/m02-simulator.sh <simulator-uuid>` runs Maestro, records with simctl,
collects screenshots and raw frame/engine JSON in `test-results/M02`, and asserts budgets.
A loopback waiter observes fixture JSON so XCTest queries do not interrupt the frame window.
Run `pnpm exec tsx apps/mobile/scripts/fixture-reference.mts` from the repository root only
when intentionally updating Node reference charts/reports after engine/knowledge changes.
The charts are compared at 1e-5 numeric tolerance; report hits, lengths and chapter keys are exact.
Frame measurements distinguish UI display-link cadence from r3f render callbacks; the encoded
video frame rate is not used as an application performance metric. Use physical phones for GPU
completion/thermal/power and sensor acceptance. Android prebuild does not require Java; native
Android build and device acceptance remain deferred until the Owner installs Java.

M04 data API: `getLocalStore()` opens the anonymous scope; `getLocalStore(userId)` isolates
an account. Use `profiles/readings/journal/settings` for CRUD, `saveJournal` for same-day edits,
and `updateSettings` for atomic patches. `changes(since)` includes redacted tombstones;
`applyRemote` accepts owned server records, resolving equal timestamps in the server's favor.
Login confirmation/import and network sync are M10/M09; anonymous records are never uploaded
by this layer. Profile versions survive edits and are removed with their dependent data on delete.
`eraseDeviceData` deletes all personal scopes, leaving only public knowledge.

`getOfflineKnowledge(system)` serves compiled `packages/content` units in both languages.
`createKnowledgeUpdater(trustedKeys)` enables the M09 public update client. Production public
keys must be provisioned in the build; downloaded keys are never trusted. The signed envelope is
`{keyId, payload, signature}`: `payload` is the exact JSON manifest string and `signature` is
lowercase Ed25519 hex over UTF-8 `tianji-knowledge-v1\n` followed by the payload. The manifest
contains `knowledgeVersion`, `baseKnowledgeVersion`, `sha256`, `compressedSize`, `decodedSize`.
The bundle is gzip JSON `{knowledgeVersion, baseKnowledgeVersion, upsert, remove, glossary?,
transitions?}`. Sizes, checksum, signature, semver, bilingual KU schema and base version are
validated before a transactional compare-and-swap; failures retain the prior offline release.

After native prebuild/rebuild (SQLCipher is unavailable in Expo Go), run
`bash apps/mobile/scripts/m04-simulator.sh <simulator-uuid>` with Metro running. The developer
route `tianji:///dev/storage` tests an isolated database, checks ciphertext bytes and wrong-key
rejection, closes/reopens the database, and deletes all ephemeral database/key material. Evidence
is stored under `test-results/M04`; this route redirects away in production builds.

M10 account flow: `/auth/login`, `/auth/verify`, `/me/settings`, and
`/me/settings/devices` use the shared `@tianji/api-client` and Worker Bearer APIs.
Tokens are a single SecureStore record; local account data and opaque sync cursors
stay in SQLCipher. Anonymous data is uploaded only after explicit confirmation.
Foreground sync runs at login/resume and every five minutes, with a manual retry.

OAuth provisioning (public IDs only; do not commit local environment files):

- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`: Google iOS client for `pub.gavin.tianji`;
  prebuild registers its reversed client scheme.
- `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`: the Google **Web** OAuth client ID,
  matching Worker's `AUTH_GOOGLE_ID`; register
  `https://tianji.gavin.pub/auth/mobile/google` as its redirect. The Worker uses
  `AUTH_GOOGLE_SECRET` and receives both PKCE proofs. Add both Google client IDs
  to `MOBILE_GOOGLE_CLIENT_IDS` on the Worker.
- `EXPO_PUBLIC_APPLE_SERVICE_ID`: Apple Services ID for Android browser login;
  register `https://tianji.gavin.pub/auth/mobile/apple`, add the ID to Worker's
  `MOBILE_APPLE_CLIENT_IDS`. iOS uses the native Apple capability already enabled
  for the documented Bundle ID and Team ID.
- Deploy the existing first-party AASA/assetlinks files. Android association
  requires `MOBILE_ANDROID_CERT_SHA256` for the actual Play signing certificate.

Use a dedicated simulator for M10 diagnostics (mock identity, no real email):
`pnpm --filter @tianji/mobile exec expo start --port 8081`, open `/dev/account`, then run
`bash apps/mobile/scripts/m10-simulator.sh <UDID>`. It verifies both provider
buttons, import consent, single-use magic-link confirmation, refresh, offline
retry, device revocation, and deletion. Screenshots go to `test-results/M10`.
Production builds reject the mock setup. HTTPS association and real provider
credentials require provisioned console settings and a signed device build.

M13 membership and ads: `/pricing` and `/me/billing` purchase the exact products
`tianji_pro_monthly` ($2.99/month, subscription) and `tianji_pro_lifetime`
($6.99 once, non-consumable), both attached to RevenueCat entitlement `pro`.
The SDK uses the signed-in Web `User.id`; guests must sign in first. Membership
refresh calls the existing authenticated Worker `/api/v1/mobile/entitlements/sync`
with an empty body. No client/mock entitlement is sent as a server grant.
Subscription management uses RevenueCat's iOS sheet or Android's official Play
subscriptions center; lifetime members can still cancel an existing monthly renewal.

Public SDK configuration (set locally, never commit `.env` or credentials):

- `EXPO_PUBLIC_REVENUECAT_TEST_API_KEY`: your RevenueCat **Test Store** `test_`
  public SDK key; development builds only. Configure both exact product IDs and
  map both to `pro` in that Test Store. This account-specific key must come from
  the project dashboard; RevenueCat has no universal working test key.
- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` / `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`:
  platform public SDK keys (`appl_` / `goog_`) for provisioned store sandbox
  accounts. Worker `REVENUECAT_SECRET_KEY` and webhook authorization remain
  server-only; the existing verified webhook must be registered in RevenueCat.
- `EXPO_PUBLIC_UMP_DEBUG_GEOGRAPHY=EEA` or `US`: development-only regional UMP
  tests. A configured AdMob project/message is required for regional consent
  forms. Google's sample app IDs can show their test tracking explanation or
  return a configuration error, which hides ads.

Google sample app IDs and `TestIds.NATIVE` are fixed for M13. The app never loads
production ad inventory. UMP precedes ATT and SDK initialization; underage or
unknown-age users receive TFUA and non-personalized requests. Rejection does not
block content. Consent failures hide ads; membership/privacy retry remains
available. Today has one slot, reports at most two slots between chapters.

Without a RevenueCat Test Store key, run the explicit development-only
`tianji:///dev/monetization` fixture. Synthetic store results exercise purchase,
restore, expiration/refund, cancellation, server-sync failure and system-manager
invocation; its UI clearly labels local testing, and it never grants real Web
access. The ad fixture loads real Google test native inventory and injects
UMP/ATT answers. The native-consent button separately runs the real UMP/ATT
adapter. Production builds redirect this route and reject fixture injection.

Rebuild the native client after installing SDKs (`expo prebuild`, `pod install`,
iOS simulator build), start Metro on port 8081, then run:
`bash apps/mobile/scripts/m13-simulator.sh <UDID> M13-billing` and
`bash apps/mobile/scripts/m13-simulator.sh <UDID> M13-ads`.
Run `M13-placements` with the same script for Today and both report slots.
The ads flow leaves tracking permission unset so Maestro cannot pre-grant ATT;
it captures the actual system prompt and refuses tracking. Native ad screenshots
assert there are no Google validator errors before dismissing its test overlay.
Evidence is saved under `test-results/M13`. Android prebuild is supported;
Android native build/device verification awaits Owner's Java installation.

## M14 accessibility, performance and monitoring

Native text follows Dynamic Type/font scaling. VoiceOver/TalkBack can use labelled
buttons, stateful radios and the chart data table; sheets focus their headings.
System and encrypted app reduce-motion settings suppress navigation/sheet motion;
reader, low-power and background states also stop decorative effects.

Sentry RN uses `EXPO_PUBLIC_SENTRY_DSN` (public ingestion address, never an auth
secret). Provision `SENTRY_ORG`, `SENTRY_PROJECT` and private `SENTRY_AUTH_TOKEN`
in the build environment for symbol/source-map uploads. Automatic network,
console, interaction breadcrumbs, replay, screenshots and view hierarchy are
disabled. `beforeSend` projects technical crash frames and finite named timing
aggregates; arbitrary messages, request bodies, user data and local variables
are discarded. Local development and M14 audit builds do not send telemetry.
Sentry's build CLI is pinned to the reviewed BSD-3-Clause 2.57.0 release.
Setup reference: https://docs.expo.dev/guides/using-sentry/

Build a dedicated simulator Release with `EXPO_PUBLIC_M14_AUDIT=true`,
`SENTRY_DISABLE_AUTO_UPLOAD=true`, `CODE_SIGNING_ALLOWED=YES` and
`CODE_SIGN_IDENTITY=-`; install with `xcrun simctl install`. Xcode injects simulated
Keychain entitlements while using a local adhoc signature. Disabling signing also
disables that injection and fails encrypted-storage startup. No certificate/key
is stored in this repo.
Run `python3 scripts/m14-cold-start.py <UDID> test-results/M14` and
`bash scripts/m14-simulator.sh <UDID>` from `apps/mobile`.
Run `python3 scripts/m14-performance.py <UDID> test-results/M14` after Maestro
exits for six observer-free performance windows. The audit route uses 500
synthetic records and the production BSC5 Atlas.
Cold timings include host simctl overhead and end after encrypted identity,
profiles and fonts are ready. UI display-link cadence is not GPU completion;
physical-device Instruments and Android native/TalkBack acceptance remain
separate checks. Use `xcrun simctl ui <UDID> content_size
accessibility-extra-extra-extra-large` to repeat the large-text audit with
`bash scripts/m14-simulator.sh <UDID> M14-accessibility`.
