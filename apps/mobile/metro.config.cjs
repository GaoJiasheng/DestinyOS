const { getDefaultConfig } = require('expo/metro-config');
// Expo detects the pnpm workspace and resolves shared source packages automatically.
const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('bin');
module.exports = config;
