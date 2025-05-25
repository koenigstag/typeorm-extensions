import { TypeOrmModule } from '@nestjs/typeorm';
import { DynamicModule } from '@nestjs/common';
import { join } from 'path';

export const driver = 'better-sqlite3' as const;
export const dbName = ':memory:' as const;

export const TypeOrmTestingModule = (entities: Function[]): DynamicModule => 
  TypeOrmModule.forRoot({
    type: driver,
    database: dbName,
    dropSchema: true,
    entities,
    synchronize: true,
  });