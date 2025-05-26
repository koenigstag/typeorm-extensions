import type { Config } from 'jest';
import * as dotenv from 'dotenv';

dotenv.config({ path: './.env.local' });

const config: Config = {
  rootDir: 'src',
  globalSetup: '<rootDir>/global-setup.ts',
  globalTeardown: '<rootDir>/global-teardown.ts',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['../../src/**/*.(t|j)s'],
  coverageDirectory: '../../coverage',
  testEnvironment: 'node',
};

export default config;
