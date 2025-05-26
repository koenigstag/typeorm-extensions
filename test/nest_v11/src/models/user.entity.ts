import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ImageEntity } from './image.entity';
import { dateColumn } from '../constants/columns';

@Entity({
  name: 'users',
  orderBy: {
    id: 'ASC',
  },
  synchronize: true,
})
export class UserEntity {
  constructor(partial: Partial<UserEntity> = {}) {
    Object.assign(this, partial);
  }

  @PrimaryGeneratedColumn('increment')
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
    type: dateColumn,
    default: () => 'CURRENT_TIMESTAMP',
    nullable: false,
  })
  public createdAt: Date;

  @UpdateDateColumn({
    type: dateColumn,
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
    nullable: false,
  })
  public updatedAt: Date;

  @OneToMany(() => ImageEntity, (image) => image.user, {
    cascade: true,
  })
  @JoinColumn({ name: 'id', referencedColumnName: 'userId' })
  public images?: ImageEntity[];
}
