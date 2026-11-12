import 'typeorm-extensions';
import { Column, DeleteDateColumn, DeleteQueryBuilder, Entity, PrimaryGeneratedColumn, UpdateQueryBuilder } from 'typeorm';
import { SoftDeleteQueryBuilder } from 'typeorm/query-builder/SoftDeleteQueryBuilder';
import { setupTest, sqlOf } from '../test-utils';
import { postgresLikeDrivers } from '../constants/database';

@Entity({ name: 'sd_notes' })
class SoftNoteEntity {
  constructor(partial: Partial<SoftNoteEntity> = {}) {
    Object.assign(this, partial);
  }

  @PrimaryGeneratedColumn('increment')
  public id: number;

  @Column({ type: 'integer', name: 'owner_id' })
  public ownerId: number;

  @Column({ type: 'varchar', name: 'note_status' })
  public status: string;

  @DeleteDateColumn({ name: 'deleted_at' })
  public deletedAt?: Date | null;
}

type Prototype = Record<string, unknown>;

setupTest('where methods on soft delete', { entities: [SoftNoteEntity] }, (context) => {
  const repository = () => context.dataSource.getRepository(SoftNoteEntity);

  const seed = () =>
    repository().save([
      new SoftNoteEntity({ ownerId: 1, status: 'open' }),
      new SoftNoteEntity({ ownerId: 2, status: 'open' }),
      new SoftNoteEntity({ ownerId: 3, status: 'done' }),
    ]);

  const keptOwners = async () =>
    (await repository().find({ order: { ownerId: 'ASC' } })).map(({ ownerId }) => ownerId);

  // the methods the library adds to update and delete queries are one function on both prototypes
  it('SHOULD add every method of update and delete queries to soft delete and restore queries', () => {
    const update = UpdateQueryBuilder.prototype as unknown as Prototype;
    const remove = DeleteQueryBuilder.prototype as unknown as Prototype;
    const softDelete = SoftDeleteQueryBuilder.prototype as unknown as Prototype;

    const added = Object.getOwnPropertyNames(update).filter(
      (name) => typeof update[name] === 'function' && update[name] === remove[name],
    );

    expect(added).toEqual(
      expect.arrayContaining(['whereIsAny', 'whereIsAnyTyped', 'whereIsIn', 'whereTyped', 'applyPeriodFilterTyped']),
    );
    expect(added.filter((name) => softDelete[name] !== update[name])).toEqual([]);
  });

  it('SHOULD soft delete and restore rows picked by typed and untyped where methods', async () => {
    await seed();

    await repository()
      .createQueryBuilder()
      .softDelete()
      .whereIsInTyped((note) => note.ownerId, [1, 2, 3])
      .andWhereTyped((note) => note.status, '=', { status: 'open' })
      .andWhereIsNotIn('owner_id', [2])
      .execute();

    expect(await keptOwners()).toEqual([2, 3]);

    await repository().createQueryBuilder().restore().whereIsIn('owner_id', [1]).execute();

    expect(await keptOwners()).toEqual([1, 2, 3]);
  });

  it('SHOULD bind the whole array of whereIsAnyTyped on a soft delete', async () => {
    const query = repository()
      .createQueryBuilder()
      .softDelete()
      .whereIsAnyTyped((note) => note.ownerId, [1, 3]);

    // TypeORM 1.x adds AND "deleted_at" IS NULL
    expect(sqlOf(query)).toMatch(/ WHERE "owner_id" = ANY\(:\w+\)/);

    if (!postgresLikeDrivers.includes(context.dataSource.options.type as never)) {
      return;
    }

    await seed();
    await query.execute();

    expect(await keptOwners()).toEqual([2]);
  });
});
