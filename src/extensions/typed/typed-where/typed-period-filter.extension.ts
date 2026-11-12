import '../../period-filter.extension';
import {
  ObjectLiteral,
  SelectQueryBuilder,
  UpdateQueryBuilder,
  DeleteQueryBuilder,
} from 'typeorm';
import { SoftDeleteQueryBuilder } from 'typeorm/query-builder/SoftDeleteQueryBuilder';
import { DeepUnwrapArray, ProxyColumnValueType } from '../../../types/modules/proxy-callback.types';
import { getTypedSingleColumnKey } from '../../../utils/query-builder.utils';
import { patchPrototype } from '../../../utils/prototype.utils';
import { attachPeriodFilter } from '../../../utils/period.utils';
import type { PeriodFilter } from '../../../types/interfaces/period.interface';
import type { ApplyPeriodOptions } from '../../../types/extensions/period.types';
import type { TypedRoot } from '../../../types/modules/typed-root.types';

// declarations

export interface TypedPeriodFilterMethods<Entity extends ObjectLiteral> {
  /**
   * Adds AND WHERE conditions for a period on an entity property:
   * `column >= :periodFrom AND column <= :periodTo`.
   * Missing, `null` or empty ends are skipped, so an empty filter adds nothing.
   * Both ends are inclusive unless `options.includeFrom` / `options.includeTo` is `false`.
   * A date-only string (`'2024-01-31'`) stands for the whole day: `periodTo: '2024-01-31'` → `column < '2024-02-01'`.
   */
  applyPeriodFilterTyped<Type extends ObjectLiteral = TypedRoot<Entity, this>>(
    selection: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
    periodFilter: PeriodFilter | null | undefined,
    options?: ApplyPeriodOptions
  ): this;
}

/* eslint-disable @typescript-eslint/no-empty-interface */
declare module 'typeorm/query-builder/WhereExpressionBuilder' {
  interface WhereExpressionBuilder extends TypedPeriodFilterMethods<ObjectLiteral> {}
}

declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity extends ObjectLiteral> extends TypedPeriodFilterMethods<Entity> {}
}

declare module 'typeorm/query-builder/UpdateQueryBuilder' {
  interface UpdateQueryBuilder<Entity extends ObjectLiteral> extends TypedPeriodFilterMethods<Entity> {}
}

declare module 'typeorm/query-builder/DeleteQueryBuilder' {
  interface DeleteQueryBuilder<Entity extends ObjectLiteral> extends TypedPeriodFilterMethods<Entity> {}
}

declare module 'typeorm/query-builder/SoftDeleteQueryBuilder' {
  interface SoftDeleteQueryBuilder<Entity extends ObjectLiteral> extends TypedPeriodFilterMethods<Entity> {}
}
/* eslint-enable @typescript-eslint/no-empty-interface */

// patching

const extension: { prototype: Partial<SelectQueryBuilder<ObjectLiteral>> } = {
  prototype: {
    applyPeriodFilterTyped<Entity extends ObjectLiteral, Type extends ObjectLiteral = TypedRoot<Entity>>(
      this: SelectQueryBuilder<Entity>,
      selection: (proxy: DeepUnwrapArray<Type>) => ProxyColumnValueType,
      periodFilter: PeriodFilter | null | undefined,
      options?: ApplyPeriodOptions
    ): SelectQueryBuilder<Entity> {
      const column = getTypedSingleColumnKey<Type>(this, selection, 'applyPeriodFilterTyped', { asTimestamp: true });

      return attachPeriodFilter(this, column, periodFilter, options);
    },
  },
};

const queryBuilders = [
  SelectQueryBuilder,
  UpdateQueryBuilder,
  DeleteQueryBuilder,
  SoftDeleteQueryBuilder,
];

queryBuilders.forEach((builder) => {
  patchPrototype(builder, extension);
});
