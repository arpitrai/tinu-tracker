module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|victory-native|@shopify/react-native-skia|react-native-reanimated)',
  ],
  moduleNameMapper: {
    '^victory-native$': '<rootDir>/__mocks__/victory-native.js',
    '^@shopify/react-native-skia$': '<rootDir>/__mocks__/@shopify/react-native-skia.js',
    '^react-native-reanimated$': '<rootDir>/__mocks__/react-native-reanimated.js',
  },
};
