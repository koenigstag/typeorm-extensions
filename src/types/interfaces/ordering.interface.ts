import { NonFunctionPropertyNames } from "../util-types";

export type OrderDirection = 'asc' | 'desc' | 'ASC' | 'DESC' | 1 | -1 | true | false;

/** `first` / `last`, or the SQL form `NULLS FIRST` / `NULLS LAST`, in any case. */
export type NullsOrder = 'first' | 'last' | 'FIRST' | 'LAST' | 'NULLS FIRST' | 'NULLS LAST' | 'nulls first' | 'nulls last';

export type OrderParam<Entity> = {
  field: NonFunctionPropertyNames<Required<Entity>>;
  /** -1 = DESC, false = DESC */
  direction?: OrderDirection;
  nulls?: NullsOrder;
  /** true = DESC, false = ASC */
  isReversed?: boolean;
  /** order by related table */
  tableAlias?: string;
};

export type OrderType = {
  selector: string;
  order?: 'ASC' | 'DESC';
  nulls?: 'NULLS FIRST' | 'NULLS LAST';
};

export interface OrderFilter<Entity> {
  orderBy?: Array<OrderParam<Entity>>;
}
