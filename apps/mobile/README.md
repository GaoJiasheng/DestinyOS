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
handwritten widgets will live under `native/` in M11. No Android native build is
required until Owner enables the Java toolchain.

The App imports Web's compiled flat `messages/{zh,zh-TW,en}.json` catalogs directly.
Run `pnpm content:build` after changing source copy. `i18next-icu` preserves Web ICU
formatting. The M01 shell uses i18next; M02 diagnostics use next-intl's native-compatible
ICU translator, with the same bilingual catalogs as Web.
Only theme and language preferences use AsyncStorage; private storage belongs to M04.

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
