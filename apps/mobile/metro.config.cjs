const { getDefaultConfig } = require('expo/metro-config');
// Expo detects the pnpm workspace and resolves shared source packages automatically.
module.exports = getDefaultConfig(__dirname);
