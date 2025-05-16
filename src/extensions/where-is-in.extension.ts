/* eslint-disable @typescript-eslint/no-explicit-any */
import { SelectQueryBuilder, WhereExpressionBuilder, ObjectLiteral } from 'typeorm';
import { randomString } from '../utils/common.utils';

// type definitions
declare module 'typeorm/query-builder/SelectQueryBuilder' {
	interface SelectQueryBuilder<Entity extends ObjectLiteral> {
		whereIsIn(this: SelectQueryBuilder<Entity>, field: string, array?: Array<any>): this;
		whereIsNotIn(this: SelectQueryBuilder<Entity>, field: string, array?: Array<any>): this;
		andWhereIsIn(this: SelectQueryBuilder<Entity>, field: string, array?: Array<any>): this;
		andWhereIsNotIn(this: SelectQueryBuilder<Entity>, field: string, array?: Array<any>): this;
		orWhereIsIn(this: SelectQueryBuilder<Entity>, field: string, array?: Array<any>): this;
		orWhereIsNotIn(this: SelectQueryBuilder<Entity>, field: string, array?: Array<any>): this;
	}
}

declare module 'typeorm/query-builder/WhereExpressionBuilder' {
	interface WhereExpressionBuilder {
		whereIsIn(this: WhereExpressionBuilder, field: string, array?: Array<any>): this;
		andWhereIsIn(this: WhereExpressionBuilder, field: string, array?: Array<any>): this;
		whereIsNotIn(this: WhereExpressionBuilder, field: string, array?: Array<any>): this;
		andWhereIsNotIn(this: WhereExpressionBuilder, field: string, array?: Array<any>): this;
		orWhereIsIn(this: WhereExpressionBuilder, field: string, array?: Array<any>): this;
		orWhereIsNotIn(this: WhereExpressionBuilder, field: string, array?: Array<any>): this;
	}
}

// implementation

const createUniqueParameterName = (prefix?: string): string => {
	const uniqueCode = randomString(5);

	return `${prefix || 'param'}_${uniqueCode}`;
};

const prepareFieldName = (field: string): string => field.includes('"') ? field : field.split('.').map(f => `"${f}"`).join('.');

function whereIn<Entity extends ObjectLiteral>(this: WhereExpressionBuilder | SelectQueryBuilder<Entity>, field: string, array?: Array<any>) {
	if (!array?.length) {
		return this.where(`FALSE`);
	}

	field = prepareFieldName(field);
	const paramName = createUniqueParameterName('whereIn');

	return this.where(`${field} IN (:...${paramName})`, { [paramName]: array });
}

function whereNotIn<Entity extends ObjectLiteral>(
	this: WhereExpressionBuilder | SelectQueryBuilder<Entity>,
	field: string,
	array?: Array<any>
) {
	if (!array?.length) {
		return this;
	}

	field = prepareFieldName(field);
	const paramName = createUniqueParameterName('whereNotIn');

	return this.where(`${field} NOT IN (:...${paramName})`, { [paramName]: array });
}

function andWhereIn<Entity extends ObjectLiteral>(
	this: WhereExpressionBuilder | SelectQueryBuilder<Entity>,
	field: string,
	array?: Array<any>
) {
	if (!array?.length) {
		return this.andWhere(`FALSE`);
	}

	field = prepareFieldName(field);
	const paramName = createUniqueParameterName('andWhereIn');

	return this.andWhere(`${field} IN (:...${paramName})`, { [paramName]: array });
}

function andWhereNotIn<Entity extends ObjectLiteral>(
	this: WhereExpressionBuilder | SelectQueryBuilder<Entity>,
	field: string,
	array?: Array<any>
) {
	if (!array?.length) {
		return this;
	}

	field = prepareFieldName(field);
	const paramName = createUniqueParameterName('andWhereNotIn');

	return this.andWhere(`${field} NOT IN (:...${paramName})`, { [paramName]: array });
}

function orWhereIn<Entity extends ObjectLiteral>(
	this: WhereExpressionBuilder | SelectQueryBuilder<Entity>,
	field: string,
	array?: Array<any>
) {
	if (!array?.length) {
		return this.orWhere(`FALSE`);
	}

	field = prepareFieldName(field);
	const paramName = createUniqueParameterName('orWhereIn');

	return this.orWhere(`${field} IN (:...${paramName})`, { [paramName]: array });
}

function orWhereNotIn<Entity extends ObjectLiteral, QB extends WhereExpressionBuilder>(
	this: QB,
	field: string,
	array?: Array<any>
): QB {
	if (!array?.length) {
		return this;
	}

	field = prepareFieldName(field);
	const paramName = createUniqueParameterName('orWhereNotIn');

	return this.orWhere(`${field} NOT IN (:...${paramName})`, { [paramName]: array });
}

// patching

// SelectQueryBuilder

SelectQueryBuilder.prototype.whereIsIn = function <Entity extends ObjectLiteral>(
	this: SelectQueryBuilder<Entity>,
	field: string,
	array?: Array<any>
): SelectQueryBuilder<Entity> {
	return whereIn.call(this, field, array);
};

SelectQueryBuilder.prototype.whereIsNotIn = function <Entity extends ObjectLiteral>(
	this: SelectQueryBuilder<Entity>,
	field: string,
	array?: Array<any>
): SelectQueryBuilder<Entity> {
	return whereNotIn.call(this, field, array);
};

SelectQueryBuilder.prototype.andWhereIsIn = function <Entity extends ObjectLiteral>(
	this: SelectQueryBuilder<Entity>,
	field: string,
	array?: Array<any>
): SelectQueryBuilder<Entity> {
	return andWhereIn.call(this, field, array);
};

SelectQueryBuilder.prototype.andWhereIsNotIn = function <Entity extends ObjectLiteral>(
	this: SelectQueryBuilder<Entity>,
	field: string,
	array?: Array<any>
): SelectQueryBuilder<Entity> {
	return andWhereNotIn.call(this, field, array);
};

SelectQueryBuilder.prototype.orWhereIsIn = function <Entity extends ObjectLiteral>(
	this: SelectQueryBuilder<Entity>,
	field: string,
	array?: Array<any>
): SelectQueryBuilder<Entity> {
	return orWhereIn.call(this, field, array);
};

SelectQueryBuilder.prototype.orWhereIsNotIn = function <Entity extends ObjectLiteral>(
	this: SelectQueryBuilder<Entity>,
	field: string,
	array?: Array<any>
): SelectQueryBuilder<Entity> {
	return orWhereNotIn.call<Entity, SelectQueryBuilder<Entity>>(this, field, array);
};

// WhereExpressionBuilder

// WhereExpressionBuilder.prototype.whereIsIn = function <Entity>(
// 	this: SelectQueryBuilder<Entity>,
// 	field: string,
// 	array?: Array<any>
// ): SelectQueryBuilder<Entity> {
// 	return whereIn.call(this, field, array);
// };

// WhereExpressionBuilder.prototype.whereIsNotIn = function <Entity>(
// 	this: SelectQueryBuilder<Entity>,
// 	field: string,
// 	array?: Array<any>
// ): SelectQueryBuilder<Entity> {
// 	return whereNotIn.call(this, field, array);
// };

// WhereExpressionBuilder.prototype.andWhereIsIn = function <Entity>(
// 	this: SelectQueryBuilder<Entity>,
// 	field: string,
// 	array?: Array<any>
// ): SelectQueryBuilder<Entity> {
// 	return andWhereIn.call(this, field, array);
// };

// WhereExpressionBuilder.prototype.andWhereIsNotIn = function <Entity>(
// 	this: SelectQueryBuilder<Entity>,
// 	field: string,
// 	array?: Array<any>
// ): SelectQueryBuilder<Entity> {
// 	return andWhereNotIn.call(this, field, array);
// };

// WhereExpressionBuilder.prototype.orWhereIsIn = function <Entity>(
// 	this: SelectQueryBuilder<Entity>,
// 	field: string,
// 	array?: Array<any>
// ): SelectQueryBuilder<Entity> {
// 	return orWhereIn.call(this, field, array);
// };

// WhereExpressionBuilder.prototype.orWhereIsNotIn = function <Entity>(
// 	this: SelectQueryBuilder<Entity>,
// 	field: string,
// 	array?: Array<any>
// ): SelectQueryBuilder<Entity> {
// 	return orWhereNotIn.call(this, field, array);
// };
