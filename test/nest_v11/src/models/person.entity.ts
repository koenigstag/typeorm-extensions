import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export class Address {
  @Column({ type: 'varchar', nullable: true })
  public city: string | null;

  @Column({ type: 'varchar', name: 'street_name', nullable: true })
  public street: string | null;
}

// Embedded columns: `address.city` is a column of `people`, not an alias
@Entity({
  name: 'people',
  orderBy: {
    id: 'ASC',
  },
  synchronize: true,
})
export class PersonEntity {
  constructor(partial: Partial<PersonEntity> = {}) {
    Object.assign(this, partial);
  }

  @PrimaryGeneratedColumn('increment')
  public id: number;

  @Column({ type: 'varchar', nullable: true })
  public name: string | null;

  @Column(() => Address)
  public address: Address;
}
