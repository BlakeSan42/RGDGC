module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    // Stub out React Native and Expo modules for pure-logic tests
    '^react-native$': '<rootDir>/src/__tests__/__mocks__/react-native.ts',
    '^expo-constants$': '<rootDir>/src/__tests__/__mocks__/expo-constants.ts',
    '^expo-secure-store$': '<rootDir>/src/__tests__/__mocks__/expo-secure-store.ts',
  },
};
