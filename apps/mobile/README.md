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
formatting. Native UI uses i18next as prescribed by the App plan; Web uses next-intl.
Only theme and language preferences use AsyncStorage; private storage belongs to M04.

`packages/ui-core/tokens` is the canonical DOM-free design token source. Its build
regenerates the stylesheet imported by Web. Fonts use the same OFL sources, renamed
and subsetted for the native shell; run `pnpm mobile:fonts` with fonttools installed
to rebuild them. All three locales are checked for Chinese shell glyph coverage.

Run the native smoke flow from the root with an installed app build:

```sh
pnpm --filter @tianji/mobile test:e2e --device <simulator-uuid>
```

Screenshots live under `apps/mobile/test-results/M01/`. M02 adds Hermes fixtures and
Skia effects; M05 adds full onboarding and the ask sheet. The M01 ask tab is an empty
route scaffold. EAS account/project linking and store submission are owned by M15.
