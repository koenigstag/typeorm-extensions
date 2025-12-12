import { NonFunctionPropertyNames } from "../util-types";

export type OrderDirection = 'asc' | 'desc' | 'ASC' | 'DESC' | 1 | -1 | true | false;

export type NullsOrder = 'first' | 'last' | 'FIRST' | 'LAST';

export type OrderParam<Entity> = {
  field: NonFunctionPropertyNames<Required<Entity>> | string;
  /** -1 = DESC, false = DESC */
  direction?: OrderDirection;
  nulls?: NullsOrder;
  /** true = DESC, false = ASC */
  isReversed?: boolean;
};

export type OrderType = {
  selector: string;
  order?: 'ASC' | 'DESC';
  nulls?: 'NULLS FIRST' | 'NULLS LAST';
};

export interface OrderFilter<Entity> {
  orderBy?: Array<OrderParam<Entity>>;
}
