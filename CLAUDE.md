# CLAUDE.md

## Project Overview

TypeORM Extensions — an npm library (`typeorm-extensions`) that adds typed, type-safe QueryBuilder extensions to TypeORM. Published on npm, documented via Docusaurus.

## Tech Stack

- **Language:** TypeScript (strict mode, ES2019 target)
- **Module system:** CommonJS
- **Peer dependency:** typeorm ^0.3.12
- **Linting:** ESLint with `@typescript-eslint`
- **Docs:** Docusaurus (in `docusaurus/` directory, deployed to `docs` branch)
- **Tests:** Jest + NestJS test app in `test/nest_v11/` (uses `better-sqlite3`, `pg`, `mysql2`, etc.)

## Commands

```bash
npm run build       # Compile TypeScript (tsc -p .)
npm run lint        # ESLint on .ts files

# Tests (run from test/nest_v11/)
# IMPORTANT: Run prepare-lib before tests to rebuild and copy the library into node_modules
cd test/nest_v11 && npm run prepare-lib  # Rebuild lib & copy into node_modules
cd test/nest_v11 && npm test             # Run Jest tests
cd test/nest_v11 && npm run test:cov     # Tests with coverage
```

## Project Structure

```
src/
├── index.ts                          # Library entry point
├── constants/                        # Shared constants
├── extensions/                       # QueryBuilder prototype extensions
│   ├── get-many-with-totals.extension.ts
│   ├── order.extension.ts
│   ├── pagination.extension.ts
│   ├── where-is-in.extension.ts
│   └── typed/                        # Type-safe extensions (select, where, joins, order-by, distinct)
│       ├── typed-distinct/
│       ├── typed-joins/
│       ├── typed-order-by/
│       ├── typed-select/
│       └── typed-where/
├── types/                            # Type definitions
│   ├── extensions/                   # Extension-specific types
│   ├── interfaces/                   # Public interfaces (pagination, ordering)
│   └── modules/                      # Internal type modules (columns, relations, proxy)
└── utils/                            # Utility functions
    ├── common.utils.ts
    ├── pagination.utils.ts
    ├── prototype.utils.ts
    ├── proxy-key.utils.ts
    ├── sql.utils.ts
    ├── table.utils.ts
    └── where.utils.ts

test/nest_v11/                        # Integration test app (NestJS + Jest)
docusaurus/                           # Documentation site source
```

## Git Workflow

- **Main branch:** `main`
- **Development branch:** `dev`
- **Docs branch:** `docs` (auto-deployed Docusaurus build)
- Commit messages are short, imperative style (e.g., "Add table helper util", "Refactor useDoubleQuotes to useQuotes")

## Key Patterns

- Extensions work by augmenting `SelectQueryBuilder.prototype` — see `src/utils/prototype.utils.ts`
- Typed extensions use proxy-based callbacks to extract entity property paths (see `src/types/modules/proxy-callback.types.ts`)
- The test app (`test/nest_v11/`) links to the library via a `prepare-lib` script that copies the built dist
- Output goes to `dist/` (gitignored)
