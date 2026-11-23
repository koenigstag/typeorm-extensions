import { SelectQueryBuilder } from 'typeorm/query-builder/SelectQueryBuilder';
import { PaginationFilter } from '../types/interfaces/pagination.interface';
import { paginateQuery } from '../utils/pagination.utils';
import { ObjectLiteral } from 'typeorm';
import { ApplyPaginationOptions } from '../types/extensions/pagination.types';
import { patchPrototype } from '../utils/prototype.utils';

// declarations

declare module 'typeorm/query-builder/SelectQueryBuilder' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface SelectQueryBuilder<Entity extends ObjectLiteral> {
    /**
     * Pages the query by `page` and `pageSize` (page 1 and 10 rows, or `defaultPageSize`, by default; never
     * more than `maxPageSize` rows): LIMIT / OFFSET, or `take` / `skip` with `useTakeAndSkip`, which a query
     * joining a collection needs.
     */
    applyPagination(
      paginationFilter: PaginationFilter,
      options?: ApplyPaginationOptions
    ): this;
  }
}

// patching

const extension: { prototype: Partial<SelectQueryBuilder<ObjectLiteral>> } = {
  prototype: {
    applyPagination<Entity extends ObjectLiteral>(
      this: SelectQueryBuilder<Entity>,
      paginationFilter: PaginationFilter,
      options?: ApplyPaginationOptions
    ) {
      return paginateQuery(this, paginationFilter, options);
    },
  },
};

patchPrototype(SelectQueryBuilder, extension);
