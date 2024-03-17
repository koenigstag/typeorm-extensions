import { stringToSQLIdentifier } from './sql.utils';

export class Identifier {
  private readonly useAlias: boolean;

  constructor(
    public readonly field: string,
    public readonly alias?: string,
    private readonly useDoubleQuotes?: boolean
  ) {
    this.useAlias = this.calcUseAlias();
  }

  fieldAsAlias(): string {
    if (this.useAlias) {
      return `${this.fieldSql} AS ${this.aliasSql}`;
    }

    return this.fieldSql;
  }

  fieldIdentifier(): string {
    if (this.useAlias) {
      return `${this.aliasSql}.${this.fieldSql}`;
    }

    return this.fieldSql;
  }

  get aliasSql(): string | undefined {
    return Identifier.aliasToSql(this.alias, this.useDoubleQuotes);
  }

  get fieldSql(): string {
    return Identifier.fieldToSql(this.field, this.useDoubleQuotes);
  }

  /* PRIVATE */

  private calcUseAlias() {
    return !!this.alias && !this.field.includes('.');
  }

  /* STATIC */

  static fieldToSql(field: string, useDoubleQuotes?: boolean): string {
    return this.toIdentifier(field, useDoubleQuotes);
  }

  static aliasToSql(
    alias: string | undefined,
    useDoubleQuotes?: boolean
  ): string | undefined {
    return alias ? this.toIdentifier(alias, useDoubleQuotes) : undefined;
  }

  static toIdentifier(value: string, useDoubleQuotes?: boolean): string {
    return useDoubleQuotes ? stringToSQLIdentifier(value) : value;
  }
}
