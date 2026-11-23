export type WhereMethods = 'where' | 'andWhere' | 'orWhere';

/** The names of the `whereIsIn` methods. */
export type WhereIsInMethodName = 'whereIsIn' | 'andWhereIsIn' | 'orWhereIsIn' | 'whereIsNotIn' | 'andWhereIsNotIn' | 'orWhereIsNotIn';

/** The names of the `whereIsAny` methods. */
export type WhereIsAnyMethodName = 'whereIsAny' | 'andWhereIsAny' | 'orWhereIsAny' | 'whereIsNotAny' | 'andWhereIsNotAny' | 'orWhereIsNotAny';

/** @deprecated Use `WhereIsInMethodName`; `WhereIsInMethods` is the interface of the methods themselves. */
export type WhereInMethods = WhereIsInMethodName;

/** @deprecated Use `WhereIsAnyMethodName`; `WhereIsAnyMethods` is the interface of the methods themselves. */
export type WhereAnyMethods = WhereIsAnyMethodName;
