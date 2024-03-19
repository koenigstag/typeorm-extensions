import { ObjectLiteral } from "typeorm";

export type SimpleColumnType = string | number | boolean | Date | null;

export type ColumnValueType = SimpleColumnType | undefined | object | ObjectLiteral;