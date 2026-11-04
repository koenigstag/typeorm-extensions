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
