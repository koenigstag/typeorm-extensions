import {
  COCKROACHDB_RESERVED_KEY_WORDS,
  findBareReservedQualifiers,
  POSTGRES_RESERVED_KEY_WORDS,
} from 'typeorm-extensions/helpers';

const words = (sql: string, list?: readonly string[]) => findBareReservedQualifiers(sql, list).map(({ word }) => word);

describe('findBareReservedQualifiers', () => {
  it.each([
    ['order."userId" = $1', ['order']],
    ['ORDER.x', ['ORDER']],
    ['Order.x', ['Order']],
    [`COALESCE(user."featureFlags" ->> 'beta', '')`, ['user']],
    ['user.id', ['user']],
    ['group . name', ['group']],
    ['group\n\t.name', ['group']],
    ['order.*', ['order']],
    [`order.details->>'status'`, ['order']],
    ['(order.id)', ['order']],
    ['x = order.id', ['order']],
    ['x::user.my_type', ['user']],
    ['SELECT order.id, user.email FROM "orders" "order", "users" "user"', ['order', 'user']],
  ])('SHOULD report %s', (sql, expected) => {
    expect(words(sql)).toEqual(expected);
  });

  it.each([
    'ORDER BY "order"."id"',
    'GROUP BY x',
    '"order".x',
    '"order"."x"',
    '"ORDER".x',
    'orders.x',
    'my_order.x',
    'order_id.x',
    'user1.x',
    'user$.x',
    'public.order.id',
    '"public" . order.id',
    'public./* comment */order.id',
    'CASE WHEN x THEN .5 ELSE .25 END',
    'SELECT .5, 1.5 FROM t',
    'order BY x',
    'ON true',
  ])('SHOULD not report %s', (sql) => {
    expect(words(sql)).toEqual([]);
  });

  describe('string literals', () => {
    it.each([
      `'order.x'`,
      `'it''s order.x'`,
      `'a' || 'order.x'`,
      `E'it\\'s order.x'`,
      `e'it\\'s order.x'`,
      `E'a\\\\' || 'order.x'`,
      `E'it''s order.x'`,
      `B'0101' || 'order.x'`,
      `U&'order.x'`,
    ])('SHOULD skip words inside %s', (sql) => {
      expect(words(sql)).toEqual([]);
    });

    it('SHOULD scan after a literal ends', () => {
      expect(words(`'it''s' || order.x`)).toEqual(['order']);
      expect(words(`E'a\\'b' || order.x`)).toEqual(['order']);
      expect(words(`E'a\\\\' || order.x`)).toEqual(['order']);
    });

    it('SHOULD read backslashes in a plain literal as characters', () => {
      expect(words(`'C:\\' || order.x`)).toEqual(['order']);
    });

    it('SHOULD read E only as a prefix of its own', () => {
      expect(words(`WHERE'x' = user.id`)).toEqual(['user']);
    });
  });

  describe('dollar-quoted strings', () => {
    it.each([
      '$$ order.x $$',
      '$$it\'s order.x$$',
      '$tag$ order.x $$ user.id $tag$',
      '$a1$ order.x $a1$',
      '$_$ order.x $_$',
    ])('SHOULD skip words inside %s', (sql) => {
      expect(words(sql)).toEqual([]);
    });

    it('SHOULD scan after the closing tag', () => {
      expect(words('$tag$ order.x $tag$ || user.id')).toEqual(['user']);
      expect(words('$$a$$, order.x')).toEqual(['order']);
    });

    it('SHOULD read $1 as a parameter, not a dollar quote', () => {
      expect(words('x = $1 AND order.id = $2')).toEqual(['order']);
    });
  });

  describe('identifiers and comments', () => {
    it.each([
      '"order.x"',
      '"a""order".x',
      '"a"" order.x"',
      '-- order.x',
      '-- order.x\r',
      '/* order.x */',
      '/* a /* order.x */ user.id */',
      '/* /* /* */ */ order.x */',
    ])('SHOULD skip words inside %s', (sql) => {
      expect(words(sql)).toEqual([]);
    });

    it('SHOULD scan after a comment or a quoted identifier ends', () => {
      expect(words('-- order.x\nuser.id')).toEqual(['user']);
      expect(words('/* a /* b */ c */ order.x')).toEqual(['order']);
      expect(words('"a""b" order.x')).toEqual(['order']);
    });
  });

  describe('parameters', () => {
    it('SHOULD skip named parameters', () => {
      expect(words('x = :order.y')).toEqual([]);
      expect(words('x IN (:...order).y')).toEqual([]);
    });

    it('SHOULD read :: as a cast, not a parameter', () => {
      expect(words('x::order.y')).toEqual(['order']);
    });
  });

  it('SHOULD give the offset of the word and the SQL around it', () => {
    const sql = `SELECT * FROM "orders" "order"\nWHERE   order."userId" = $1 AND "order"."status" = $2 AND "order"."total" > $3`;
    const [found] = findBareReservedQualifiers(sql);

    expect(found.index).toBe(sql.indexOf('order."userId"'));
    expect(found.snippet).toBe('…"orders" "order" WHERE order."userId" = $1 AND…');
  });

  it('SHOULD look for the words passed instead of the defaults', () => {
    expect(words('t.x, order.x', ['t'])).toEqual(['t']);
    expect(words('left.x, order.x', [...POSTGRES_RESERVED_KEY_WORDS, 'left'])).toEqual(['left', 'order']);
    expect(words('order.x', [])).toEqual([]);
  });

  it('SHOULD reject a word that is no key word', () => {
    expect(() => findBareReservedQualifiers('x', ['order.'])).toThrow(TypeError);
    expect(() => findBareReservedQualifiers('x', [''])).toThrow(TypeError);
    expect(() => findBareReservedQualifiers('x', [1 as never])).toThrow(TypeError);
  });

  it('SHOULD default to the reserved key words of PostgreSQL', () => {
    expect(POSTGRES_RESERVED_KEY_WORDS).toHaveLength(78);
    expect(POSTGRES_RESERVED_KEY_WORDS).toEqual(expect.arrayContaining(['ORDER', 'USER', 'GROUP', 'SYSTEM_USER']));
    expect(POSTGRES_RESERVED_KEY_WORDS).not.toEqual(expect.arrayContaining(['LEFT']));
    expect(Object.isFrozen(POSTGRES_RESERVED_KEY_WORDS)).toBe(true);

    expect(COCKROACHDB_RESERVED_KEY_WORDS).not.toContain('SYSTEM_USER');
    expect(COCKROACHDB_RESERVED_KEY_WORDS).toEqual(expect.arrayContaining(['ORDER', 'CONCURRENTLY', 'CURRENT_SCHEMA']));
  });
});
