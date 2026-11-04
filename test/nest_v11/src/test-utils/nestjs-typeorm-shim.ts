// Stand-in for `@nestjs/typeorm` in tests against TypeORM 1.x (see jest.typeorm1.config.ts):
// `@nestjs/typeorm` 11 doesn't work with TypeORM 1.x, and 12 is ESM-only, which this CommonJS Jest
// setup can't load. It provides only what the test harness uses.
import type { DynamicModule } from '@nestjs/common';
import { DataSource, DataSourceOptions } from 'typeorm';

let current: DataSource | undefined;

export const getRepositoryToken = (entity: { name: string }): string => `${entity.name}Repository`;

export const TypeOrmModule = {
  forRoot(options: DataSourceOptions): DynamicModule {
    return {
      module: class TypeOrmShimModule {},
      global: true,
      providers: [
        {
          provide: DataSource,
          useFactory: async () => {
            // the harness builds a module for each test and never closes the previous one
            if (current?.isInitialized) {
              await current.destroy();
            }

            current = await new DataSource(options).initialize();
            return current;
          },
        },
      ],
      exports: [DataSource],
    };
  },
};
