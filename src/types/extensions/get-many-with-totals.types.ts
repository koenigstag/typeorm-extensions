export type GetManyWithTotalsOptions = {
  disableTotalsCalculation?: boolean;
  loadAll?: boolean;
};

export interface ListWithTotals<Entity> {
  list: Entity[];
  total: number | null;
  limit: number | null;
  offset: number | null;
}
