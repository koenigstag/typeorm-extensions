import type { Config } from 'jest';
import config from './jest.config';

/**
 * Jest config for TypeORM 1.x. `@nestjs/typeorm` 11 doesn't work with TypeORM 1.x, and 12 is ESM-only,
 * so the test harness gets its DataSource from a CommonJS stand-in instead.
 */
const typeorm1Config: Config = {
  ...config,
  moduleNameMapper: {
    ...config.moduleNameMapper,
    '^@nestjs/typeorm$': '<rootDir>/test-utils/nestjs-typeorm-shim.ts',
  },
};

export default typeorm1Config;
