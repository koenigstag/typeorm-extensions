import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { describe, beforeEach } from '@jest/globals';
import { Class } from '../types';
import { TypeOrmTestingModule } from './typeorm-testing.module';

export type RepositoriesMap<T extends readonly Class[]> = {
  [K in T[number] as K['name']]: Repository<InstanceType<K>>;
};

export function getRepositoriesMap<T extends readonly Class[]>(
  moduleRef: TestingModule,
  entities: T,
): RepositoriesMap<T> {
  const result: Record<string, Repository<any>> = {};

  for (const entity of entities) {
    const token = getRepositoryToken(entity);
    result[entity.name] = moduleRef.get(token, { strict: false });
  }

  return result as RepositoriesMap<T>;
}

export const setupTest = <T extends readonly Class[]>(
  name: string,
  props: { entities: T; tests: (repos: RepositoriesMap<T>) => void },
) => {
  describe(name, () => {
    let moduleRef: TestingModule;
    const repositories: RepositoriesMap<T> = {} as RepositoriesMap<T>;

    beforeEach(async () => {
      moduleRef = await Test.createTestingModule({
        imports: [
          ...TypeOrmTestingModule(props.entities),
        ],
      }).compile();

      Object.assign(repositories, getRepositoriesMap(moduleRef, props.entities));
    });

    props.tests(repositories);
  });
};
