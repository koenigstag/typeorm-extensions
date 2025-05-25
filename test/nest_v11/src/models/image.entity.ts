import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from "typeorm";
import { UserEntity } from "./user.entity";

@Entity({
  name: 'images',
  orderBy: {
    id: 'ASC',
  },
  synchronize: true,
  withoutRowid: true,
})
export class ImageEntity {

  constructor(partial: Partial<ImageEntity> = {}) {
    Object.assign(this, partial);
  }

  @PrimaryColumn({ type: 'integer' })
  public id: number;

  @Column({ type: 'varchar', nullable: false })
  public url: string;

  @Column({ type: 'integer', nullable: false })
  public userId: number;

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


  @ManyToOne(() => UserEntity, (user) => user.images, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'userId', referencedColumnName: 'id' })
  public user?: UserEntity;
}
