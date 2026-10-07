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
