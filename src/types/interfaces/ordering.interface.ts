export type OrderDirection = 'asc' | 'desc' | 'ASC' | 'DESC';

export type NullsOrder = 'first' | 'last' | 'FIRST' | 'LAST';

export type OrderBy<Entity> = {
  field: keyof Entity | string;
  direction?: OrderDirection;
  nulls?: NullsOrder;
};

export interface OrderFilter<Entity> {
  orderBy?: Array<OrderBy<Entity>>;
}
