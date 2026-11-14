import { ColumnOptions, getMetadataArgsStorage } from 'typeorm';
import { GeneratedColumn } from 'typeorm-extensions/decorators/generated-column.decorator';
import { LineItemEntity } from '../models/line-item.entity';
import { setupTest } from '../test-utils';

setupTest('GeneratedColumn', { entities: [LineItemEntity] }, (context) => {
  const items = () => context.dataSource.getRepository(LineItemEntity);
  const reload = (id: number) => items().findOneByOrFail({ id });

  it('SHOULD read the value the database computes, and never write one', async () => {
    const saved = await items().save(new LineItemEntity({ price: 3, quantity: 4, total: 999 }));
    expect((await reload(saved.id)).total).toBe(12);

    saved.price = 5;
    saved.total = 1;
    await items().save(saved);
    expect((await reload(saved.id)).total).toBe(20);
  });

  it('SHOULD leave the column out of the INSERT and UPDATE that query builders build', async () => {
    const insert = items().createQueryBuilder().insert().values({ price: 2, quantity: 2, total: 7 });
    expect(insert.getQuery()).not.toMatch(/total/);
    await insert.execute();

    const update = items().createQueryBuilder().update().set({ quantity: 3, total: 7 }).where('price = 2');
    expect(update.getQuery()).not.toMatch(/total/);
    await update.execute();

    expect((await items().findOneByOrFail({ price: 2 })).total).toBe(6);
  });

  it('SHOULD keep the other column options, select: false included', async () => {
    const { id } = await items().save(new LineItemEntity({ price: 1, quantity: 2 }));

    expect((await reload(id)).sum).toBeUndefined();
    expect((await items().findOneOrFail({ where: { id }, select: { id: true, sum: true } })).sum).toBe(3);

    const column = items().metadata.findColumnWithPropertyName('sum');
    expect([column?.isInsert, column?.isUpdate, column?.isSelect]).toEqual([false, false, false]);
  });

  it('SHOULD drop readonly, which TypeORM 0.3 applies after update', () => {
    class Untyped {
      @GeneratedColumn({ type: 'integer', readonly: false } as ColumnOptions)
      public value: number;
    }

    const args = getMetadataArgsStorage().columns.find((column) => column.target === Untyped);
    expect(args?.options).toMatchObject({ type: 'integer', insert: false, update: false });
    expect(args?.options).not.toHaveProperty('readonly');
  });
});
