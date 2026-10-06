module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/test/**/*.test.ts?(x)'],
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!\\.pnpm/|(jest-)?react-native|@react-native/|expo(nent)?|@expo/|expo-.*|@tianji/|react-native-.*|@react-navigation/)',
  ],
};
