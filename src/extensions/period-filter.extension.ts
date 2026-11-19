import {
  SelectQueryBuilder,
  ObjectLiteral,
} from 'typeorm';
import { patchPrototypes, WHERE_QUERY_BUILDERS } from '../utils/prototype.utils';
import type { PeriodFilter } from '../types/interfaces/period.interface';
import type { ApplyPeriodOptions } from '../types/extensions/period.types';
import { toFieldSql } from '../utils/query-builder.utils';
import { attachPeriodFilter } from '../utils/period.utils';

// declarations

export interface PeriodFilterMethods {
  /**
   * Adds AND WHERE conditions for a period: `field >= :periodFrom AND field <= :periodTo`.
   * Missing, `null` or empty ends are skipped, so an empty filter adds nothing.
   * Both ends are inclusive unless `options.includeFrom` / `options.includeTo` is `false`.
   * A date-only string (`'2024-01-31'`) stands for the whole day: `periodTo: '2024-01-31'` → `field < '2024-02-01'`.
   * Invalid dates (`new Date('x')`, `'2024-02-30'`) throw a `TypeError`.
   */
  applyPeriodFilter(
    field: string,
    periodFilter: PeriodFilter | null | undefined,
    options?: ApplyPeriodOptions
  ): this;
}

/* eslint-disable @typescript-eslint/no-empty-interface, @typescript-eslint/no-unused-vars */
declare module 'typeorm/query-builder/WhereExpressionBuilder' {
  interface WhereExpressionBuilder extends PeriodFilterMethods {}
}

declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity extends ObjectLiteral> extends PeriodFilterMethods {}
}

declare module 'typeorm/query-builder/UpdateQueryBuilder' {
  interface UpdateQueryBuilder<Entity extends ObjectLiteral> extends PeriodFilterMethods {}
}

declare module 'typeorm/query-builder/DeleteQueryBuilder' {
  interface DeleteQueryBuilder<Entity extends ObjectLiteral> extends PeriodFilterMethods {}
}

declare module 'typeorm/query-builder/SoftDeleteQueryBuilder' {
  interface SoftDeleteQueryBuilder<Entity extends ObjectLiteral> extends PeriodFilterMethods {}
}
/* eslint-enable @typescript-eslint/no-empty-interface, @typescript-eslint/no-unused-vars */

// patching

const extension: { prototype: Partial<SelectQueryBuilder<ObjectLiteral>> } = {
  prototype: {
    applyPeriodFilter<Entity extends ObjectLiteral>(
      this: SelectQueryBuilder<Entity>,
      field: string,
      periodFilter: PeriodFilter | null | undefined,
      options?: ApplyPeriodOptions
    ): SelectQueryBuilder<Entity> {
      return attachPeriodFilter(this, toFieldSql(this, field), periodFilter, options);
    },
  },
};

patchPrototypes(WHERE_QUERY_BUILDERS, extension);
