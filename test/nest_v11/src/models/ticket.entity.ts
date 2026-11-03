import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Properties and database column names differ on purpose: typed keys must use the column names
@Entity({
  name: 'tickets',
  orderBy: {
    id: 'ASC',
  },
  synchronize: true,
})
export class TicketEntity {
  constructor(partial: Partial<TicketEntity> = {}) {
    Object.assign(this, partial);
  }

  @PrimaryGeneratedColumn('increment', { name: 'ticket_id' })
  public id: number;

  @Column({ type: 'varchar', name: 'ticket_status' })
  public status: string;

  @Column({ type: 'integer', name: 'owner_id', nullable: true })
  public ownerId: number | null;
}
