import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { Json } from 'typeorm-extensions/types/modules/proxy-callback.types';

export type ArticleMeta = {
  status: string;
  author?: { name: string };
  flags?: string[];
  score?: number;
  published?: boolean;
};

/**
 * PostgreSQL-only column types (arrays, jsonb), so it is not part of `allEntities`:
 * pass it to `setupTest` explicitly in PostgreSQL-only tests.
 * Properties and column names differ on purpose: typed keys must use the column names.
 */
@Entity({
  name: 'articles',
  orderBy: {
    id: 'ASC',
  },
  synchronize: true,
})
export class ArticleEntity {
  constructor(partial: Partial<ArticleEntity> = {}) {
    Object.assign(this, partial);
  }

  @PrimaryGeneratedColumn('increment')
  public id: number;

  @Column({ type: 'varchar' })
  public title: string;

  @Column({ type: 'text', array: true, default: () => `'{}'` })
  public tags: string[];

  @Column({ type: 'integer', array: true, name: 'reviewer_ids', nullable: true })
  public reviewerIds: number[] | null;

  @Column({ type: 'jsonb', nullable: true })
  public meta: Json<ArticleMeta> | null;

  @Column({ type: 'json', name: 'legacy_meta', nullable: true })
  public legacyMeta: ArticleMeta | null;
}
