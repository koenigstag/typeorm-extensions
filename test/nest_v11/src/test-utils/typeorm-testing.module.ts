import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DynamicModule } from '@nestjs/common';
import { Class } from '../types';

export const TypeOrmTestingModule = (
  entities: readonly Class[],
  options: Omit<TypeOrmModuleOptions, 'entities'>,
): DynamicModule =>
  TypeOrmModule.forRoot({
    synchronize: true,
    logging: false,
    ...(options as any),
    entities: entities as Class[],
  });
