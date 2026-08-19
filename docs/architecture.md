# Layers

```
views / components  →  utils  →  services  →  domain
stores              →  services (patch builders only)  →  domain  →  Repository
```

**Imports point downward only. Sideways and upward imports are errors. Skipping a layer downward
is fine** — a view may call `domain/format.ts` directly; it may never call another screen's
`utils.ts`.

| Layer | Holds | Never |
|---|---|---|
| `src/domain/` | The calculus: money, currency, FX, period and rollup functions; all entity types | imports anything outside `src/domain/` |
| `src/services/` | Rules two or more screens share, and every builder of a persisted record | `vue`, `pinia`, `@ionic/*`, `ionicons`, `@/stores`, `@/views`, `@/components`, `@/data`, `async`, the clock |
| `src/views/<V>/utils.ts`, `src/components/<C>/utils.ts` | That one screen's filters, groupings, chart geometry, labels, form completeness | `vue`, `@/stores`, `@ionic/*`, refs, another screen's folder |
| `src/stores/budget.ts` | The loaded records, the writes, the load lifecycle | any calculation |

`src/domain/` is effectively frozen: it has 100+ tests and they are the contract. Change it only
with a spec, and prefer composing its existing exports — several were unused while screens
hand-rolled the same logic, which is how the FX rate bug survived.

## The SELECT test (stores)

> A store member is allowed only if it could be written as a SQL `SELECT` with no expressions: a
> column projection, a `WHERE` on a stored field, an `ORDER BY`, or a key lookup. If it needs
> arithmetic, a currency conversion, date math, a threshold, or a `LIMIT` chosen for one screen, it
> does not belong in the store.

That is what keeps `base`, `periodConfig`, the `*ById` maps, `expenseCategories`,
`incomeCategories`, `balanceOf`, `periodOffset` and `isCurrentPeriod` on the store while every
rollup lives above it. An id index is a read; a budget status is a calculation.

## Five rules that settle arguments

1. **A service may build a record; only a store may write one.** No service is `async`.
2. **More than one repository write → the store owns the sequence** (and may call a service to
   compute each patch). **One write with a computed payload → the caller computes, the store
   writes.** This is why `addWallet` still updates the currency shortlist itself, and why a goal
   contribution is built by the screen and handed to `addTransaction`.
3. **Two screens need it → a service. Two screens need the *markup* → a component. One screen
   needs it → that screen's `utils.ts`.**
4. **Utils export pure functions of plain values.** The `.vue` wraps them in `computed()`. Utils
   never touch a ref, never import the store, never import `vue`, and never receive the `props`
   object — only individual prop values.
5. **`today` is always an argument**, never a `todayIso()` call inside a util or service. Without
   this, half the services would need fake timers and their tests would be slower and flakier.

### Where things go, when it is not obvious

| Question | Answer |
|---|---|
| Is this value acceptable? | service (`services/money.parsePositiveAmount`) |
| Is this form complete? | that screen's utils (`canSaveBudget`) |
| A threshold that picks a colour | the component (`ProgressMeter`'s `WARNING_AT_PERCENT`) |
| A threshold that picks a number or word the user reads | a service |
| Chart geometry | utils. A *shared* chart is a component, never a service |
| Display labels | the component's utils, taking resolved entities rather than the store |
| A one-line pass-through to domain | neither — call domain directly. An anaemic wrapper layer is cost without benefit |

## The one reactivity rule

Build a utils function's argument literal **inside** the `computed` callback:

```ts
const view = computed(() => homeView({ periodOffset: store.periodOffset, /* … */ }))
```

Hoisting it to setup scope freezes the primitives, so the screen stops following the period
switcher while its arrays keep updating — a half-live screen that no type check catches.

**Wiring:** three or fewer derived values, wire them as separate computeds. Four or more, export
one view-model function from utils and wire a single computed. Split instead when the argument sets
genuinely differ — `TransactionsPage` keeps its filters separate because they change on every
keystroke while the transaction list does not.

## Naming and layout

- **Every view is a folder**: `src/views/<Name>/<Name>.vue`. Uniform router paths are worth the
  two single-file folders that result.
- **A component becomes a folder** when it gains a second file.
- **The logic file is always `utils.ts`**, its spec always `utils.spec.ts`, colocated. The folder
  already names the screen. This filename is load-bearing — the enforcement globs key off it.
- **No `index.ts`, anywhere.** Barrels hide the dependency graph the import rule depends on.
- **A view gets a `utils.ts` when it has a rule you can get wrong** — a sign convention, a
  threshold, a multi-predicate filter, a grouping, a payload shape, a completeness check.
  Constants and one-expression computeds do not earn a file. `SettingsPage`, `OnboardingPage`,
  `MorePage`, `EmptyState` and `PeriodSwitcher` have none, and that is correct. `TabsPage` gained
  one when it gained the swipe gesture: the tab order, the no-wrap neighbour rule, the edge damping
  and the commit thresholds are all rules you can get wrong — and the pure part is the only part of
  a gesture jsdom can test.
- **`services/<x>.ts`** is named after the `domain/<x>.ts` it extends or the entity whose records
  it builds. Nothing else may be a service filename.
- **`useBudgetStore()` may appear only in `*.vue`, `src/router/index.ts`, and
  `src/composables/useBudgetContext.ts`.**
- **`src/composables/` contains exactly one file.** `useBudgetContext` exists because most screens
  need `ctx` and `period`, neither of which is stored, and duplicating them would duplicate the
  clock read too. It holds no logic — both bodies are single service calls. **A second file
  requires an ADR in `docs/`.**

## Enforcement

`src/architecture.spec.ts` asserts all of the above that can be checked mechanically — import
direction per layer, service purity, no clock below the view, `useBudgetStore` confinement, one
composable, and a sibling spec for every `utils.ts`. It runs under `npm test`.

No linter, deliberately: eslint plus an import plugin and a flat config is four dependencies and a
new CI failure mode to satisfy one rule, and it still could not express "no `useBudgetStore`
outside a `.vue`" or "every `utils.ts` has a spec" — which are the rules most likely to be broken.
The guard has been verified to fail on deliberate violations; if you change it, check that it still
can.

## Known and deferred

- **`todayIso()` inside a computed never invalidates**, so an app left open across midnight shows a
  stale period and trend. True before this refactor too. It is now *fixable* without touching a
  layer: services take `today`, so a clock ref ticked by a visibility listener — next to the
  existing `flushSnapshot` listener in `App.vue` — is the whole change. Do not "fix" it by reading
  the clock inside a service, which would make every dependent spec non-deterministic.
- **Some rollups are computed twice** where the store used to compute them once — Home and Budgets
  both build budget statuses, and Ionic keeps both tab pages mounted. Acceptable because `reload()`
  already replaces every state ref after each mutation, so nothing was cached across mutations
  anyway. If profiling ever demands it, memoise inside the service. **Do not put derivation back in
  the store.**
- **The create/edit modal scaffolding is still duplicated** across five screens (~250 lines of
  `openNew`/`openEdit`/`editingId` plumbing). Left alone deliberately: it is UI state, not business
  logic, and the five instances already diverge. The right dedupe for now is pattern consistency —
  every utils names its functions `canSave`/`buildPayload`, every `.vue` names its handlers
  `openNew`/`openEdit`/`save`/`remove`. Revisit at the sixth CRUD screen.
- **`dayGroups`' sign convention** goes through `domain/periodSummary` over a one-day range. It
  arguably belongs in `domain/budgeting` outright; it was kept out to leave the domain diff empty
  during the refactor.
