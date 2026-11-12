import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import type { Alias } from 'typeorm/query-builder/Alias';
import type { ColumnMetadata } from 'typeorm/metadata/ColumnMetadata';
import type { RelationMetadata } from 'typeorm/metadata/RelationMetadata';
import type { EntityMetadata } from 'typeorm/metadata/EntityMetadata';
import type { WhereMethods } from '../types/extensions';
import type { DeepUnwrapArray, KeyPathEnd, KeyProxyCallback } from '../types/modules/proxy-callback.types';
import type { TypedRoot } from '../types/modules/typed-root.types';
import { attachExists } from './where-exists.extension';
import { patchPrototype } from '../utils/prototype.utils';
import { getTypedSelectionKey } from '../utils/query-builder.utils';
import { andWhereNarrowing } from '../utils/where.utils';

/**
 * The relation to look in, selected by a typed callback: `user => user.images`. A relation of a joined alias
 * (`joins => joins.owner.images`) ends the key path, so its entity type isn't known: pass it as `Related`.
 */
type RelationSelection<Type, Related> = (proxy: DeepUnwrapArray<Type>) => Related | KeyPathEnd | null | undefined;

/** Narrows the rows of the related entity: `images => images.andWhere('images.url IS NOT NULL')`. */
type RelatedCondition<Related extends ObjectLiteral> = (subQuery: SelectQueryBuilder<Related>) => unknown;

// declarations

/**
 * `EXISTS` / `NOT EXISTS` over a relation of an entity, with the join condition taken from the relation's
 * metadata: `andWhereRelationExists(user => user.images, 'image', (images) => images.andWhere(…))` gives
 * `EXISTS (SELECT 1 FROM "images" "image" WHERE … AND "image"."userId" = "user"."id")`. Works for
 * one-to-many, many-to-one, one-to-one and many-to-many (through the junction table) relations.
 *
 * `alias` names the related entity in the subquery and must not be an alias of the outer query.
 * The subquery's parameters get unique names, as in `whereNotExists`.
 */
export interface WhereRelationExistsMethods<Entity extends ObjectLiteral> {
  /** Sets `WHERE EXISTS (…)` over the relation, replacing the WHERE conditions set before. */
  whereRelationExists<Related extends ObjectLiteral, Type extends ObjectLiteral = TypedRoot<Entity, this>>(
    relation: RelationSelection<Type, Related>,
    alias: string,
    where?: RelatedCondition<Related>
  ): this;
  /** Adds `AND EXISTS (…)` over the relation. */
  andWhereRelationExists<Related extends ObjectLiteral, Type extends ObjectLiteral = TypedRoot<Entity, this>>(
    relation: RelationSelection<Type, Related>,
    alias: string,
    where?: RelatedCondition<Related>
  ): this;
  /** Adds `OR EXISTS (…)` over the relation. */
  orWhereRelationExists<Related extends ObjectLiteral, Type extends ObjectLiteral = TypedRoot<Entity, this>>(
    relation: RelationSelection<Type, Related>,
    alias: string,
    where?: RelatedCondition<Related>
  ): this;
  /** Sets `WHERE NOT EXISTS (…)` over the relation, replacing the WHERE conditions set before. */
  whereRelationNotExists<Related extends ObjectLiteral, Type extends ObjectLiteral = TypedRoot<Entity, this>>(
    relation: RelationSelection<Type, Related>,
    alias: string,
    where?: RelatedCondition<Related>
  ): this;
  /** Adds `AND NOT EXISTS (…)` over the relation. */
  andWhereRelationNotExists<Related extends ObjectLiteral, Type extends ObjectLiteral = TypedRoot<Entity, this>>(
    relation: RelationSelection<Type, Related>,
    alias: string,
    where?: RelatedCondition<Related>
  ): this;
  /** Adds `OR NOT EXISTS (…)` over the relation. */
  orWhereRelationNotExists<Related extends ObjectLiteral, Type extends ObjectLiteral = TypedRoot<Entity, this>>(
    relation: RelationSelection<Type, Related>,
    alias: string,
    where?: RelatedCondition<Related>
  ): this;
}

/* eslint-disable @typescript-eslint/no-empty-interface, @typescript-eslint/no-unused-vars */
declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity extends ObjectLiteral> extends WhereRelationExistsMethods<Entity> {}
}
/* eslint-enable @typescript-eslint/no-empty-interface, @typescript-eslint/no-unused-vars */

// patching

type AnyRelationSelection = RelationSelection<ObjectLiteral, ObjectLiteral>;
type AnyRelatedCondition = RelatedCondition<ObjectLiteral>;

const createMethod = (method: WhereMethods, negate: boolean) =>
  function <Entity extends ObjectLiteral>(
    this: SelectQueryBuilder<Entity>,
    relation: AnyRelationSelection,
    alias: string,
    where?: AnyRelatedCondition
  ): SelectQueryBuilder<Entity> {
    return attachRelationExists(this, method, negate, relation, alias, where);
  };

const extension: { prototype: Partial<SelectQueryBuilder<ObjectLiteral>> } = {
  prototype: {
    whereRelationExists: createMethod('where', false),
    andWhereRelationExists: createMethod('andWhere', false),
    orWhereRelationExists: createMethod('orWhere', false),
    whereRelationNotExists: createMethod('where', true),
    andWhereRelationNotExists: createMethod('andWhere', true),
    orWhereRelationNotExists: createMethod('orWhere', true),
  } as Partial<SelectQueryBuilder<ObjectLiteral>>,
};

patchPrototype(SelectQueryBuilder, extension);

// implementation

function attachRelationExists<Entity extends ObjectLiteral>(
  builder: SelectQueryBuilder<Entity>,
  method: WhereMethods,
  negate: boolean,
  relationSelection: AnyRelationSelection,
  alias: string,
  where?: AnyRelatedCondition
): SelectQueryBuilder<Entity> {
  const methodName = `${method}Relation${negate ? 'Not' : ''}Exists`;
  const key = getTypedSelectionKey(builder, relationSelection as unknown as KeyProxyCallback<ObjectLiteral>);

  if (Array.isArray(key)) {
    throw new TypeError(`${methodName} expects the callback to select one relation, got ${key.length}: ${key.join(', ')}`);
  }

  const dot = key.indexOf('.');
  const ownerAlias = key.slice(0, dot);
  const propertyPath = key.slice(dot + 1);
  const aliases = queryAliases(builder);
  const owner = aliases.find((candidate) => candidate.name === ownerAlias);
  const relation = owner?.hasMetadata ? owner.metadata.findRelationWithPropertyPath(propertyPath) : undefined;

  if (!relation) {
    throw new TypeError(`${methodName}: ${key} is not a relation of an entity of the query`);
  }

  // in the subquery the alias would hide the outer one the join condition refers to; SQLite matches
  // names without case, so 'USER' would hide 'user' there
  if (aliases.some((candidate) => candidate.name.toLowerCase() === alias.toLowerCase())) {
    throw new TypeError(`${methodName}: the alias "${alias}" is already used by the query, choose another one`);
  }

  const column = (aliasName: string, columnName: string) => `${builder.escape(aliasName)}.${builder.escape(columnName)}`;
  const subQuery = builder.connection
    .createQueryBuilder()
    .select('1')
    .from(relation.inverseEntityMetadata.target, alias);

  const correlation = joinCondition(relation, ownerAlias, alias, column, subQuery);

  where?.(subQuery);
  // after the caller's conditions, so a `where` or an `orWhere` of theirs can't drop or bypass it
  andWhereNarrowing(subQuery, correlation);

  return attachExists(builder, method, subQuery, negate);
}

type NestedQuery = { expressionMap: { aliases: Alias[]; mainAlias?: Alias }; parentQueryBuilder?: NestedQuery };

/**
 * The aliases of the query and of the queries it is part of. Inside `Brackets` the builder has the outer
 * query's main alias but none of its joins: those are on its parent.
 */
function queryAliases<Entity extends ObjectLiteral>(builder: SelectQueryBuilder<Entity>): Alias[] {
  const aliases: Alias[] = [];
  // parentQueryBuilder is protected in TypeORM's types
  let query = builder as unknown as NestedQuery | undefined;

  for (; query; query = query.parentQueryBuilder) {
    const { aliases: own, mainAlias } = query.expressionMap;
    aliases.push(...own, ...(mainAlias ? [mainAlias] : []));
  }

  return aliases;
}

type ColumnSql = (aliasName: string, columnName: string) => string;

const equal = (left: string, right: string) => `${left} = ${right}`;

/** The condition between the related rows (`alias`) and the outer row (`ownerAlias`); joins the junction table of a many-to-many. */
function joinCondition(
  relation: RelationMetadata,
  ownerAlias: string,
  alias: string,
  column: ColumnSql,
  subQuery: SelectQueryBuilder<ObjectLiteral>
): string {
  const referenced = (joinColumn: ColumnMetadata) => (joinColumn.referencedColumn as ColumnMetadata).databaseName;

  if (relation.isManyToMany) {
    const junctionAlias = `${alias}_junction`;
    // the owning side defines the junction table; from the other side its columns swap roles
    const inverse = relation.inverseRelation;
    const [ownerColumns, relatedColumns] = relation.isOwning
      ? [relation.joinColumns, relation.inverseJoinColumns]
      : [(inverse as RelationMetadata).inverseJoinColumns, (inverse as RelationMetadata).joinColumns];

    subQuery.innerJoin(
      ((relation.junctionEntityMetadata ?? (inverse as RelationMetadata).junctionEntityMetadata) as EntityMetadata).target,
      junctionAlias,
      relatedColumns.map((joinColumn) => equal(column(alias, referenced(joinColumn)), column(junctionAlias, joinColumn.databaseName))).join(' AND ')
    );

    return ownerColumns
      .map((joinColumn) => equal(column(junctionAlias, joinColumn.databaseName), column(ownerAlias, referenced(joinColumn))))
      .join(' AND ');
  }

  // the join columns are on the outer entity's table
  if (relation.isManyToOne || relation.isOneToOneOwner) {
    return relation.joinColumns
      .map((joinColumn) => equal(column(alias, referenced(joinColumn)), column(ownerAlias, joinColumn.databaseName)))
      .join(' AND ');
  }

  // one-to-many, or the inverse side of a one-to-one: the join columns are on the related table
  return (relation.inverseRelation as RelationMetadata).joinColumns
    .map((joinColumn) => equal(column(alias, joinColumn.databaseName), column(ownerAlias, referenced(joinColumn))))
    .join(' AND ');
}
