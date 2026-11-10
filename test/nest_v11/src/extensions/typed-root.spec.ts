import 'typeorm-extensions/extensions/typed';
import { setupTest, createFakeUsers, createFakeImages, sqlOf } from '../test-utils';
import { ImageEntity, UserEntity } from '../models';

type Joins = { user: UserEntity; images: ImageEntity };

setupTest('typed', undefined, (context) => {
  const users = () => context.dataSource.getRepository(UserEntity).createQueryBuilder('user').leftJoin('user.images', 'images');

  it('SHOULD return the builder itself, its typed callbacks rooted at the aliases', () => {
    const query = users();
    const typed = query.typed<Joins>();

    expect(typed).toBe(query);

    typed
      .selectTyped((q) => q.user.id, 'id')
      .whereTyped((q) => q.images.url, '=', 'a.png')
      .andWhereIsInTyped((q) => q.user.id, [1, 2])
      .orderByTyped((q) => q.images.id);

    const sql = sqlOf(typed);

    expect(sql).toMatch(/WHERE "images"\."url" = :where\w+ AND "user"\."id" IN \(/);
    expect(sql).toMatch(/ORDER BY "images"\."id"/);
  });

  it('SHOULD load the entities as before', async () => {
    await context.dataSource.getRepository(UserEntity).save(await createFakeUsers({ count: 2 }));
    await context.dataSource
      .getRepository(ImageEntity)
      .save(await createFakeImages({ count: 2, getOverrides: (i) => ({ id: i + 1, userId: 2, url: `image-${i + 1}` }) }));

    const found = await users().typed<Joins>().whereTyped((q) => q.images.url, '=', 'image-2').getMany();

    expect(found.map(({ id }) => id)).toEqual([2]);
  });
});
