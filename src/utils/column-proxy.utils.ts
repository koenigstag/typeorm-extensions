// the column references of the returningTyped and onConflictTyped callbacks

const COLUMN_REF = Symbol('typed column');

type ColumnRef = { readonly [COLUMN_REF]: true };

export const isColumnRef = (value: unknown): value is ColumnRef =>
  (typeof value === 'function' || typeof value === 'object') && value !== null && COLUMN_REF in value;

/** A property path read lazily: it becomes SQL when it is used as a string. */
export const columnProxy = (path: string[], toSql: (path: string[]) => string, members: Record<string, unknown> = {}): unknown =>
  new Proxy(() => undefined, {
    has: (_target, key) => key === COLUMN_REF,
    get: (_target, key) => {
      if (key === COLUMN_REF) {
        return true;
      }

      if (key === Symbol.toPrimitive || key === 'toString' || key === 'valueOf') {
        return () => toSql(path);
      }

      if (typeof key !== 'string' || key === 'then') {
        return undefined;
      }

      if (key in members) {
        return members[key];
      }

      return columnProxy([...path, key], toSql);
    },
  });
