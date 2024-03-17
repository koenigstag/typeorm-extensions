import { NonFunctionPropertyNames } from "../util-types";

export type OrderDirection = 'asc' | 'desc' | 'ASC' | 'DESC';

export type NullsOrder = 'first' | 'last' | 'FIRST' | 'LAST';

export type OrderParam<Entity> = {
  field: NonFunctionPropertyNames<Required<Entity>> | string;
  direction?: OrderDirection;
  nulls?: NullsOrder;
};

export type OrderType = {
	selector: string;
  order: 'ASC' | 'DESC';
  nulls?: 'NULLS FIRST' | 'NULLS LAST';
};

export interface OrderFilter<Entity> {
  orderBy?: Array<OrderParam<Entity>>;
}
