import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { GeneratedColumn } from 'typeorm-extensions/decorators/generated-column.decorator';

// `total` is computed by the database: TypeORM must read it and never write it
@Entity({ name: 'line_items', synchronize: true })
export class LineItemEntity {
  constructor(partial: Partial<LineItemEntity> = {}) {
    Object.assign(this, partial);
  }

  @PrimaryGeneratedColumn('increment')
  public id: number;

  @Column({ type: 'integer' })
  public price: number;

  @Column({ type: 'integer' })
  public quantity: number;

  @GeneratedColumn({ type: 'integer', asExpression: 'price * quantity', generatedType: 'STORED' })
  public total: number;

  @GeneratedColumn('integer', { asExpression: 'price + quantity', generatedType: 'STORED', select: false })
  public sum?: number;
}
