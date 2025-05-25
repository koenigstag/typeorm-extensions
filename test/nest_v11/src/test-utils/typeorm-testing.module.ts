import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import * as betterSqlite3 from 'better-sqlite3';
import { DynamicModule } from '@nestjs/common';
import { Class } from '../types';

export const defaultDriver = 'better-sqlite3' as const;
export const defaultDBName = ':memory:' as const;

export const TypeOrmTestingModule = (
  entities: readonly Class[],
  options?: Omit<TypeOrmModuleOptions, 'entities'>,
): DynamicModule[] => [
  TypeOrmModule.forRoot({
    dropSchema: true,
    synchronize: true,
    type: defaultDriver,
    driver: betterSqlite3,
    database: defaultDBName,
    ...(options as any),
    entities: entities as Class[],
  }),
  TypeOrmModule.forFeature(entities as Class[]),
];
