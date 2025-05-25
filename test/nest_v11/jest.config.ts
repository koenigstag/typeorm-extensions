import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'test/nest_v11',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['../../src/**/*.(t|j)s'],
  coverageDirectory: '../../coverage',
  testEnvironment: 'node',
};

export default config;
