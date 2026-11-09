# Docs roadmap

Ideas for the documentation that are agreed on but not started yet.

## Examples: a navigation section of real-world recipes

The current Examples (`docs/examples`) are short references for one method each. Turn them into a top-level
navbar section of recipes: how to solve real tasks with the library, from simple to complex.

### Navigation

- A sidebar of its own: move `examples` out of the `docs` sidebar into an `examples` sidebar in `sidebars.ts`,
  and add `{ type: 'docSidebar', sidebarId: 'examples', label: 'Examples' }` to the navbar:
  **Docs · Examples · API · Playground**.
- Same docs plugin, not a second plugin instance: the URLs stay `/docs/examples/...` (no broken links), and
  recipes and API pages keep linking to each other with relative `.md` links.
- Categories by task, not by level (people look for "how to build a feed"); the level is a badge on each recipe.
- Remove the Docusaurus template leftovers `docs/tutorial-basics` and `docs/tutorial-extras` in the same change.

### Recipe format

Each recipe is one page:

1. **Task**: what is needed, e.g. "an activity feed with infinite scroll".
2. **Solution**: the whole code, not a fragment.
3. **SQL**: the query it produces.
4. **Pitfalls**: why the obvious way doesn't work.
5. **See also**: the API pages.

All recipes use one domain: the playground's entities (`docusaurus/playground/src/models.ts`), extended when a
recipe needs more (e.g. an `Order`). Then every recipe gets a "▶ Play" button and can be checked at build time;
see the Play buttons plan in `docusaurus/playground/README.md`.

### Recipes

| Category | Recipe | Level | Shows |
|---|---|---|---|
| Filtering | List endpoint with filters from query parameters | simple | DTO → `applyOrderFilter` + `getManyWithTotals`; empty filters are no-ops |
| Filtering | Report for a period | simple | `applyPeriodFilter`; "January 31st until midnight" pitfall; last 30 days |
| Filtering | "Tickets not assigned to me", unassigned included | simple | `<>` drops NULL rows, `whereIsDistinctFrom` keeps them |
| Filtering | Search results in the search engine's order | simple | `whereIsAny` + `orderByArrayPosition` |
| Joins | Several typed joins | medium | alias-keyed `type Joins = { orders: Order; host: User }` |
| Joins | Reusable query fragments | complex | functions like `applyVisibility(qb, user)` with typed conditions; `tableHelper` inside `joinOn` |
| JSON & arrays | Settings in JSONB | medium | `whereJsonContains`, `tableHelper.jsonColumn`, GIN index |
| JSON & arrays | Tags in an array column | medium | any tag vs all tags; `text[]` vs a join table |
| Writes | Close stale tickets and return their ids | medium | `applyPeriodFilter` + `returningTyped` on UPDATE |
| Pagination | Activity feed | complex | `getManyWithCursor` + a filter by event types (readonly array) + joins with `useTakeAndSkip` |
| Pagination | Walk a whole table in batches | complex | export / migration with `getManyWithCursor` in a loop; why not OFFSET (1M rows: OFFSET 980000 took 87 ms, the cursor 0.06 ms) |
| Reporting | Dashboard in one query | complex | aggregates with `tableHelper` (`count`, `cast`, JSONB paths) and `GROUP BY`; `selectTyped` column order in `UNION` |

Plus a **Before / after** page: the same queries in plain TypeORM and with the extensions.

### Order of work

1. Base the branch on the docs coverage PR (#10), which already changes `sidebars.ts` and `docs/examples`.
2. Start with the navigation and four recipes that show the most: list endpoint, period report, typed joins,
   activity feed. Check the format on them, then add the rest.
