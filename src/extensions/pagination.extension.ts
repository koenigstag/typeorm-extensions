/* eslint-disable @typescript-eslint/no-explicit-any */
import { SelectQueryBuilder } from 'typeorm/query-builder/SelectQueryBuilder';
import { PaginationFilter } from '../types/interfaces/pagination.interface';
import { defaultUseTakeAndSkip } from '../constants';
import { getLimitAndOffset } from '../utils/pagination.utils';
import { ObjectLiteral } from 'typeorm';
import { ApplyPaginationOptions } from '../types/extensions/pagination.types';
import { patchPrototype } from '../utils/prototype.utils';

// declarations

declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity extends ObjectLiteral> {
    applyPaginationFilter(
      paginationFilter: PaginationFilter,
      options?: ApplyPaginationOptions
    ): SelectQueryBuilder<Entity>;
  }
}

// patching

const extension: { prototype: Partial<SelectQueryBuilder<ObjectLiteral>> } = {
  prototype: {
    applyPaginationFilter<Entity extends ObjectLiteral>(
      this: SelectQueryBuilder<Entity>,
      paginationFilter: PaginationFilter,
      options?: ApplyPaginationOptions
    ) {
      return applyPaginationFilter<SelectQueryBuilder<Entity>>(
        this,
        paginationFilter,
        options
      );
    },
  },
};

patchPrototype(SelectQueryBuilder, extension);

// implementation

function applyPaginationFilter<QB extends SelectQueryBuilder<any>>(
  builder: QB,
  paginationFilter: PaginationFilter,
  options?: ApplyPaginationOptions
): QB {
  const { useTakeAndSkip = defaultUseTakeAndSkip } = options || {};

  const { limit, offset } = getLimitAndOffset(paginationFilter);

  if (useTakeAndSkip) {
    return builder.take(limit).skip(offset);
  }

  return builder.limit(limit).offset(offset);
}
