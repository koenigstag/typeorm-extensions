import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({
  name: 'users',
  orderBy: {
    id: 'ASC',
  },
  synchronize: true,
  withoutRowid: true,
})
export class UserEntity {
  @PrimaryColumn({ type: 'integer' })
  public id: number;

  @Column({
    type: 'varchar',
    nullable: false,
  })
  public firstName: string;

  @Column({
    type: 'varchar',
    nullable: false,
  })
  public lastName: string;

  @Column({
    type: 'varchar',
    unique: true,
    nullable: false,
  })
  public email: string;

  @CreateDateColumn({
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
    nullable: false,
  })
  public createdAt: Date;

  @UpdateDateColumn({
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
    nullable: false,
  })
  public updatedAt: Date;
}
