---
sidebar_position: 4
---

# Strict order input

## Description

An opt-in check of every order `applyOrder` and `applyOrderFilter` take. With it on, an order whose `field` is not a name (`firstName`) or the path of an embedded column (`address.city`), whose `tableAlias` is not one name, or whose `nulls` is not `first`, `last`, `NULLS FIRST` or `NULLS LAST` (in any case), throws an `InvalidOrderError` before the query is built.

Off by default, an order is taken as given: its field and table alias are quoted as one identifier each, so nothing in them reaches the SQL as code, and an unknown `nulls` is left out. A field that names no column then fails in the database, when the query runs. When orders come from a request, turn the check on once, where the extensions are loaded: every caller gets it, including one written later that would not know to validate the order first, and the error can be answered as a bad request in one place.

`direction` and `isReversed` stay lenient: whatever they hold orders one way or the other.

## Signature

```typescript
import { disableStrictOrderInput, enableStrictOrderInput, InvalidOrderError } from 'typeorm-extensions/helpers';

enableStrictOrderInput(): void
disableStrictOrderInput(): void

class InvalidOrderError extends TypeError {
  readonly part: 'order' | 'field' | 'tableAlias' | 'alias' | 'nulls';
  readonly value: unknown;
}
```

`InvalidOrderError` is also thrown with the check off, for an order without a string `field` (`part: 'order'`) and for an expression in place of a name with `useQuotes: false` (`part: 'field'` or `'alias'`).

## Usage

```typescript
import 'typeorm-extensions';
import { enableStrictOrderInput, InvalidOrderError } from 'typeorm-extensions/helpers';

enableStrictOrderInput();

// a NestJS exception filter: a bad order from a client is a 400, not a 500
@Catch(InvalidOrderError)
export class InvalidOrderFilter implements ExceptionFilter {
  catch(error: InvalidOrderError, host: ArgumentsHost) {
    host.switchToHttp().getResponse().status(400).json({ message: `Invalid order ${error.part}` });
  }
}

query.applyOrderFilter(filter.orderBy); // { field: 'id; DROP TABLE users' } throws an InvalidOrderError
```
