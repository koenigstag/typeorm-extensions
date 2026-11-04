# Playground

The `/playground` page of the docs: a TypeScript editor (Monaco) with the library's types, and
PostgreSQL compiled to WebAssembly ([PGlite](https://pglite.dev)) running the code in the browser.

- `src/models.ts`: the demo entities, also shown read only in the editor (`import … from 'playground'`)
- `src/examples.ts`: the examples of the drop-down
- `src/runtime.ts`: TypeORM's browser build + typeorm-extensions from `../../src` + PGlite; seeds the tables
  before every run and records the SQL through a TypeORM logger
- `src/main.ts`: the editor, its types, compiling and running the code
- `build.mjs`: builds everything into `static/playground-assets` (git-ignored); it runs before
  `npm start` / `npm run build`, or alone with `npm run build:playground`
- `../src/pages/playground.tsx`: the page around it

The library is compiled from this repository's `src`, so the playground always shows the current code, not the
published package. `npm run typecheck:playground` type-checks these sources.

## Next: "Play" buttons in the API docs

Not implemented yet. The idea, agreed on but postponed:

1. **Button.** Wrap Docusaurus' `CodeBlock` (swizzle in wrap mode, no copy of the theme) so that code blocks
   marked `playground` in their meta get a "▶ Play" button:

   ````md
   ```ts playground
   query.whereIsAny('user.id', [1, 2, 3])
   ```
   ````

   It links to `/playground#code=<lz-string>`, the same format as the Share button (`codeFromUrl` in `src/main.ts`).

2. **Hidden prelude.** Doc examples are fragments (`query` isn't defined, entities are named `UserEntity`,
   `ImageEntity`, …), so a block holds the whole program and the lines before `// ---cut---` are hidden in the
   docs but sent to the playground, like TypeScript's twoslash:

   ````md
   ```ts playground
   import { dataSource, User } from 'playground';
   const query = dataSource.getRepository(User).createQueryBuilder('user');
   // ---cut---
   export default query.whereIsAny('user.id', [1, 2, 3]);
   ```
   ````

   Blocks opt in one by one; start with the pages whose SQL is the most telling: `whereIsAny`, `applyPeriodFilter`,
   `getManyWithCursor`.

3. **Later: check the examples at build time.** Once the examples are whole programs, the docs build can run them
   (PGlite runs in Node too): a broken example fails the build, and the SQL each example produces can be shown
   under it instead of hand-written SQL comments.
