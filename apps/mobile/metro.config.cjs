const { getSentryExpoConfig } = require('@sentry/react-native/metro');
// Expo detects the pnpm workspace and resolves shared source packages automatically.
const config = getSentryExpoConfig(__dirname);
config.resolver.assetExts.push('bin');
module.exports = config;

// DESIGN-GAP: Lazy module evaluation keeps offline knowledge and heavy chart scenes outside the first interactive frame.
config.transformer.getTransformOptions = async () => ({
  transform: { experimentalImportSupport: false, inlineRequires: true },
});
