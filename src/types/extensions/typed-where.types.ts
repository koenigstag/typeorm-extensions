export type TypedWhereOptions = {
  /**
   * Append a placeholder for the value to the condition (`=` → `= :param`). Defaults to `true`,
   * or to `false` when the condition already references a key of the parameters (`'= :id'` with `{ id }`).
   */
  addValue?: boolean;
};
