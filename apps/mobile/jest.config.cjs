module.exports = {
  preset: 'jest-expo',
  // DESIGN-GAP: Expo and the Web workspace use distinct React versions; resolve shared test dependencies through the mobile renderer's React instance.
  moduleNameMapper: {
    '^react$': require.resolve('react'),
    '^react/(.*)$': '<rootDir>/node_modules/react/$1',
  },
  testMatch: ['<rootDir>/test/**/*.test.ts?(x)'],
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!\\.pnpm/|(jest-)?react-native|@react-native/|expo(nent)?|@expo/|expo-.*|@tianji/|react-native-.*|@react-navigation/)',
  ],
};
