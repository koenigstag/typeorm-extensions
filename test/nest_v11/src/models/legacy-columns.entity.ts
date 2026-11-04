import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Column names that aren't plain identifiers: string fields of the untyped methods must still be quoted
@Entity({
  name: 'legacy_rows',
  orderBy: {
    id: 'ASC',
  },
  synchronize: true,
})
export class LegacyColumnsEntity {
  constructor(partial: Partial<LegacyColumnsEntity> = {}) {
    Object.assign(this, partial);
  }

  @PrimaryGeneratedColumn('increment')
  public id: number;

  @Column({ type: 'varchar', name: 'first-name' })
  public firstName: string;

  @Column({ type: 'varchar', name: 'last name', nullable: true })
  public lastName: string | null;
}
