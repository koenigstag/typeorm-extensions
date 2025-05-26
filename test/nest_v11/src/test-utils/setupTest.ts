import { getRepositoryToken, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, Repository } from 'typeorm';
import { describe, beforeEach } from '@jest/globals';
import { Class } from '../types';
import { TypeOrmTestingModule } from './typeorm-testing.module';
import { allEntities } from '../models/all-entities';
import {
  databaseName,
  databaseHost,
  databasePassword,
  databasePort,
  databaseUsername,
  databaseDriver,
  dropSchema,
  postgresLikeDrivers,
} from '../constants/database';

type Repositories<T extends readonly Class[]> = {
  [K in keyof T]: T[K] extends Class ? Repository<InstanceType<T[K]>> : never;
};

export function getRepositories<T extends readonly Class[]>(
  moduleRef: TestingModule,
  entities: T,
): Repositories<T> {
  const result: Repository<any>[] = [];

  for (const entity of entities) {
    const token = getRepositoryToken(entity);
    result.push(moduleRef.get(token, { strict: false }));
  }

  return result as Repositories<T>;
}

export type TestContext<T extends readonly Class[]> = {
  name: string;
  entities: T;

  typeormOptions: TypeOrmModuleOptions & {
    type: Required<TypeOrmModuleOptions>['type'];
  };

  moduleRef: TestingModule;
  dataSource: DataSource;
};

export const setupTest = <T extends readonly Class[] = typeof allEntities>(
  name: string,
  props:
    | {
        entities: T;
        beforeEach?: (context: TestContext<T>) => void | Promise<void>;
        typeormOptions?: Omit<
          TypeOrmModuleOptions,
          | 'entities'
          | 'type'
          | 'database'
          | 'host'
          | 'port'
          | 'username'
          | 'password'
        >;
      }
    | null
    | undefined,
  tests: (context: TestContext<T>) => void,
) => {
  props =
    props ??
    ({
      entities: allEntities,
    } as any);

  if (!props) {
    throw new Error('Props cannot be null or undefined');
  }

  if (!props.entities || props.entities.length === 0) {
    props.entities = allEntities as unknown as T;
  }

  describe(name, () => {
    const sharedContext: TestContext<T> = {
      name,
      entities: props.entities,
      moduleRef: null as unknown as TestingModule,
      dataSource: null as unknown as DataSource,
      typeormOptions: {
        ...props.typeormOptions,
        synchronize: true,
        logging: false,
        type: databaseDriver,
        database: databaseName,
        host: databaseHost,
        port: databasePort,
        username: databaseUsername,
        password: databasePassword,
        dropSchema: dropSchema,
      },
    };

    beforeEach(async () => {
      sharedContext.moduleRef = await Test.createTestingModule({
        imports: [
          TypeOrmTestingModule(props.entities, sharedContext.typeormOptions),
        ],
      }).compile();

      sharedContext.dataSource = sharedContext.moduleRef.get(DataSource);
      // sharedContext.repositories = getRepositories(sharedContext.moduleRef, props.entities);

      await props.beforeEach?.(sharedContext);
    });

    tests(sharedContext);
  });
};
