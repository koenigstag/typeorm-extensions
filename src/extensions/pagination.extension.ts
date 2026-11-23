import { SelectQueryBuilder } from 'typeorm/query-builder/SelectQueryBuilder';
import { OffsetPaginationFilter, PaginationFilter } from '../types/interfaces/pagination.interface';
import { paginateQuery } from '../utils/pagination.utils';
import { ObjectLiteral } from 'typeorm';
import { ApplyPaginationOptions } from '../types/extensions/pagination.types';
import { patchPrototype } from '../utils/prototype.utils';

// declarations

declare module 'typeorm/query-builder/SelectQueryBuilder' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface SelectQueryBuilder<Entity extends ObjectLiteral> {
    /**
     * Pages the query by `page` and `pageSize`, or, when the filter gives neither, by `offset` and `limit`
     * (the first page, counted from `firstPage`, and 10 rows, or `defaultPageSize`, by default; never more than
     * `maxPageSize` rows; a `PageOutOfRangeError` past `maxPage`): LIMIT / OFFSET, or `take` / `skip` with
     * `useTakeAndSkip`, which a query joining a collection needs. Options the call leaves out come from
     * `setPaginationDefaults`.
     */
    applyPagination(
      paginationFilter: PaginationFilter | OffsetPaginationFilter,
      options?: ApplyPaginationOptions
    ): this;
  }
}

// patching

const extension: { prototype: Partial<SelectQueryBuilder<ObjectLiteral>> } = {
  prototype: {
    applyPagination<Entity extends ObjectLiteral>(
      this: SelectQueryBuilder<Entity>,
      paginationFilter: PaginationFilter | OffsetPaginationFilter,
      options?: ApplyPaginationOptions
    ) {
      return paginateQuery(this, paginationFilter, options);
    },
  },
};

patchPrototype(SelectQueryBuilder, extension);
