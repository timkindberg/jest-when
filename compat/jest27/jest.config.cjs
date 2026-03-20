const path = require('path');
const tsJestTransformer = require.resolve('ts-jest');

module.exports = {
  rootDir: path.resolve(__dirname, '../..'),
  testEnvironment: 'node',
  verbose: false,
  collectCoverage: false,
  testMatch: [
    '<rootDir>/src/**/*.test.ts'
  ],
  modulePathIgnorePatterns: [
    '<rootDir>/dist',
    '<rootDir>/dist-test',
    '<rootDir>/compat/jest27/dist',
    '<rootDir>/compat/jest27/dist-test'
  ],
  transform: {
    '^.+\\.tsx?$': [
      tsJestTransformer,
      {
        tsconfig: '<rootDir>/compat/jest27/tsconfig.test.json'
      }
    ]
  },
  resetModules: true
};
