import 'typeorm-extensions/extensions/where-relation-exists.extension';
import 'typeorm-extensions/extensions/typed/typed-where/typed-where.extension';
import { Column, Entity, JoinColumn, JoinTable, ManyToMany, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { createFakeUsers, setupTest } from '../test-utils';
import { ImageEntity, UserEntity } from '../models';

@Entity({ name: 'rx_groups', synchronize: true })
class GroupEntity {
  constructor(partial: Partial<GroupEntity> = {}) {
    Object.assign(this, partial);
  }

  @PrimaryGeneratedColumn('increment')
  public id: number;

  @Column({ type: 'varchar' })
  public name: string;

  @ManyToMany(() => MemberEntity, (member) => member.groups)
  public members?: MemberEntity[];

  @OneToOne(() => MemberEntity, (member) => member.leads)
  // a union, so the emitted design:type is Object, not MemberEntity before its declaration
  public leader?: MemberEntity | null;
}

@Entity({ name: 'rx_members', synchronize: true })
class MemberEntity {
  constructor(partial: Partial<MemberEntity> = {}) {
    Object.assign(this, partial);
  }

  @PrimaryGeneratedColumn('increment')
  public id: number;

  @Column({ type: 'varchar' })
  public name: string;

  @ManyToMany(() => GroupEntity, (group) => group.members)
  @JoinTable({ name: 'rx_members_groups' })
  public groups?: GroupEntity[];

  @OneToOne(() => GroupEntity, (group) => group.leader, { nullable: true })
  @JoinColumn({ name: 'leads_id' })
  public leads?: GroupEntity | null;
}

setupTest('where-relation-exists', { entities: [UserEntity, ImageEntity, GroupEntity, MemberEntity] }, (context) => {
  // user 1 has images 1, 2; user 2 image 3; user 3 none
  const seedImages = async () => {
    await context.dataSource.getRepository(UserEntity).save(await createFakeUsers({ count: 3 }));
    await context.dataSource
      .getRepository(ImageEntity)
      .save([1, 1, 2].map((userId, i) => new ImageEntity({ id: i + 1, userId, url: `image-${i + 1}` })));
  };

  // ann is in groups a and b and leads a, bob is in b, cid in none; group c has no members
  const seedGroups = async () => {
    const [a, b] = await context.dataSource
      .getRepository(GroupEntity)
      .save(['a', 'b', 'c'].map((name) => new GroupEntity({ name })));

    await context.dataSource.getRepository(MemberEntity).save([
      new MemberEntity({ name: 'ann', groups: [a, b], leads: a }),
      new MemberEntity({ name: 'bob', groups: [b] }),
      new MemberEntity({ name: 'cid', groups: [] }),
    ]);
  };

  const userIds = async (query: ReturnType<typeof users>) => (await query.getMany()).map(({ id }) => id);
  const users = () => context.dataSource.getRepository(UserEntity).createQueryBuilder('user');
  const names = async (query: { getMany(): Promise<{ name: string }[]> }) => (await query.getMany()).map(({ name }) => name).sort();

  it('SHOULD look in a one-to-many relation, with conditions and parameters of its own', async () => {
    await seedImages();

    expect(await userIds(users().andWhereRelationExists((u) => u.images, 'image'))).toEqual([1, 2]);
    expect(await userIds(users().andWhereRelationNotExists((u) => u.images, 'image'))).toEqual([3]);

    // the subquery's :url doesn't take the outer one's value
    expect(
      await userIds(
        users()
          .where('user.firstName <> :url', { url: 'nobody' })
          .andWhereRelationExists((u) => u.images, 'image', (images) => images.andWhere('image.url = :url', { url: 'image-3' })),
      ),
    ).toEqual([2]);
  });

  it('SHOULD keep the join condition whatever conditions the callback sets', async () => {
    await seedImages();

    // the callback's `where` comes first and can't replace it, and its `orWhere` can't escape it:
    // `url = image-1 OR url = image-3 AND <join>` would let user 3 in through image 1
    const query = users().andWhereRelationExists((u) => u.images, 'image', (images) =>
      images
        .where('image.url = :first', { first: 'image-1' })
        .orWhere('image.url = :third', { third: 'image-3' })
        .andWhereTyped((i) => i.id, '>', 0),
    );

    expect(await userIds(query)).toEqual([1, 2]);
  });

  it('SHOULD look in a many-to-one relation', async () => {
    await seedImages();

    const images = await context.dataSource
      .getRepository(ImageEntity)
      .createQueryBuilder('image')
      .andWhereRelationExists((i) => i.user, 'owner', (owner) => owner.andWhere('owner.id = :id', { id: 1 }))
      .getMany();

    expect(images.map(({ id }) => id)).toEqual([1, 2]);

    // a relation of a joined alias: images whose owner has another image
    type Joins = { image: ImageEntity; owner: UserEntity };
    const withSiblings = await context.dataSource
      .getRepository(ImageEntity)
      .createQueryBuilder('image')
      .innerJoin('image.user', 'owner')
      .andWhereRelationExists<ImageEntity, Joins>((j) => j.owner.images, 'sibling', (siblings) =>
        siblings.andWhere('sibling.id <> image.id'),
      )
      .getMany();

    expect(withSiblings.map(({ id }) => id)).toEqual([1, 2]);
  });

  it('SHOULD look through the junction table of a many-to-many relation, from either side', async () => {
    await seedGroups();

    const members = () => context.dataSource.getRepository(MemberEntity).createQueryBuilder('member');
    const groups = () => context.dataSource.getRepository(GroupEntity).createQueryBuilder('grp');

    expect(
      await names(members().andWhereRelationExists((m) => m.groups, 'g', (g) => g.andWhere('g.name = :name', { name: 'b' }))),
    ).toEqual(['ann', 'bob']);
    expect(
      await names(groups().andWhereRelationExists((g) => g.members, 'm', (m) => m.andWhere('m.name = :name', { name: 'ann' }))),
    ).toEqual(['a', 'b']);
    expect(await names(groups().andWhereRelationNotExists((g) => g.members, 'm'))).toEqual(['c']);
  });

  it('SHOULD look in a one-to-one relation, from either side', async () => {
    await seedGroups();

    expect(
      await names(
        context.dataSource.getRepository(MemberEntity).createQueryBuilder('member').andWhereRelationExists((m) => m.leads, 'led'),
      ),
    ).toEqual(['ann']);
    expect(
      await names(
        context.dataSource.getRepository(GroupEntity).createQueryBuilder('grp').andWhereRelationExists((g) => g.leader, 'lead'),
      ),
    ).toEqual(['a']);
  });

  it('SHOULD throw for a property that is no relation, and for an alias of the outer query', () => {
    expect(() => users().andWhereRelationExists((u) => u.firstName as never, 'x')).toThrow(
      /andWhereRelationExists: user\.firstName is not a relation/,
    );
    expect(() => users().andWhereRelationExists((u) => u.images, 'user')).toThrow(/the alias "user" is already used/);
  });
});
