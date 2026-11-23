import { GeneratedColumn, GeneratedColumnOptions } from 'typeorm-extensions';

class Invoice {
  @GeneratedColumn({ type: 'integer', asExpression: 'price * quantity', generatedType: 'STORED' })
  total: number;

  @GeneratedColumn('varchar', { length: 10, nullable: true, select: false })
  day?: string | null;
}
void Invoice;

// @ts-expect-error a generated column is never inserted
const insertable: GeneratedColumnOptions = { type: 'integer', insert: true };
// @ts-expect-error nor updated
const updatable: GeneratedColumnOptions = { type: 'integer', update: true };
void insertable;
void updatable;
