export default {
  automock: true,
  clearMocks: true,
  globals: {
    'ts-jest': {
      compiler: 'ttypescript',
      tsconfig: '<rootDir>/tsconfig.tests.json',
    },
  },
  moduleFileExtensions: ['js', 'ts'],
  moduleNameMapper: {
    '^#/(.*)': '<rootDir>/src/$1',
  },
  resetModules: true,
  rootDir: process.cwd(),
  setupFilesAfterEnv: [
    '<rootDir>/node_modules/jest-extended/all',
    '<rootDir>/node_modules/reflect-metadata/Reflect.js',
  ],
  testEnvironment: 'node',
  testMatch: ['<rootDir>/__tests__/*.test.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  unmockedModulePathPatterns: [
    '<rootDir>/node_modules/class-transformer/',
    '<rootDir>/node_modules/decorator-cache-getter/',
    '<rootDir>/node_modules/jest-extended/',
    '<rootDir>/node_modules/jest-mock-extended/',
  ],
  verbose: false,
};
