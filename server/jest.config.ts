import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  moduleNameMapper: {
    '^@core/(.*)$': '<rootDir>/src/core/$1',
    '^@features/(.*)$': '<rootDir>/src/features/$1',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      diagnostics: false,
    }],
    '^.+\\.js$': ['ts-jest', {
      diagnostics: false,
    }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(jose)/)',
  ],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/server.ts',
    '!src/**/index.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 70,
      lines: 80,
      statements: 80,
    },
  },
};

export default config;
