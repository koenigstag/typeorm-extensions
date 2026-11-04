// Demo entities of the playground: import them from 'playground'.
// The tables live in PostgreSQL (PGlite, compiled to WebAssembly) running in this page,
// and are refilled with the same demo rows before every run.
import {
  Column,
  DataSource,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type UserMetadata = {
  role: 'admin' | 'user';
  settings: { theme: 'light' | 'dark'; language: string };
};

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar' })
  firstName: string;

  @Column({ type: 'varchar' })
  lastName: string;

  @Column({ type: 'varchar', unique: true })
  email: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: UserMetadata | null;

  @Column({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => Image, (image) => image.user)
  images: Image[];
}

@Entity({ name: 'images' })
export class Image {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar' })
  url: string;

  @Column({ type: 'integer' })
  userId: number;

  @ManyToOne(() => User, (user) => user.images)
  @JoinColumn({ name: 'userId' })
  user: User;
}

/** Properties and column names differ: typed methods use the column names. */
@Entity({ name: 'tickets' })
export class Ticket {
  @PrimaryGeneratedColumn({ name: 'ticket_id' })
  id: number;

  @Column({ type: 'varchar', name: 'ticket_status' })
  status: 'open' | 'in_progress' | 'closed';

  @Column({ type: 'integer', name: 'owner_id', nullable: true })
  ownerId: number | null;
}

/** PostgreSQL array and jsonb columns. */
@Entity({ name: 'articles' })
export class Article {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'text', array: true })
  tags: string[];

  @Column({ type: 'jsonb' })
  meta: { status: 'draft' | 'published'; author?: { name: string } };

  @Column({ type: 'timestamp', name: 'published_at', nullable: true })
  publishedAt: Date | null;
}

export const entities = [User, Image, Ticket, Article];

/** The playground's data source: PostgreSQL in this page, with the entities above. */
export declare const dataSource: DataSource;
