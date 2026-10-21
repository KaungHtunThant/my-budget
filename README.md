# My Budget

An offline-first Android app for managing a monthly income: record what comes in and what
goes out, set a spending limit per category, save towards goals, and hold money in more
than one currency.

Everything lives on the device. The app makes no network requests — even its icons and
fonts are bundled — and the only planned online feature is an optional Google Drive backup,
which comes after a local file backup.

**Current status: 2.0.0 — Stage 2 with local backup done; app lock and release hardening next.**

| Milestone | State |
|---|---|
| Stage 1 prototype (every screen, real money/FX/period logic) | Done — v1.0.0 |
| N0–N3: IndexedDB store of record, contract tests, cut-over, JSON snapshot backstop | Done |
| Layering refactor: calculation moved out of the store and view scripts into `services/` and per-screen `utils.ts`, enforced by a spec | Done |
| Per-cycle budgets with recurring copies, schema 2 and its migration | Done — v2.0.0 |
| D3: local backup — export via the share sheet, versioned restore with conflict-aware merge or replace | Done — v2.0.0 |
| D4: app lock, upgrade testing, on-device performance, signed release APK | **Next** |
| D5: Google Drive backup | Planned |

Since persistence landed: salary, payslips and payday allocation were removed (pay is ordinary
income now), recurring bills and budget limits can be entered in any currency with the rate frozen
on the record, and the tab pages can be changed by swiping left or right. In 2.0.0 each cycle got
its own budget plan — recurring budgets copy themselves into each new cycle — and backup and
restore arrived, versioned by the app version that wrote each file.

See [`docs/PLAN.md`](docs/PLAN.md) for the plan, [`docs/features.md`](docs/features.md) for the
live scope, and [`CHANGELOG.md`](CHANGELOG.md) for what changed.

## Stack

| | |
|---|---|
| UI | Vue 3 + TypeScript, Composition API, Ionic Framework (Vue) |
| Native shell | Capacitor 7 → Android APK |
| State | Pinia |
| Build / test | Vite, Vitest, `fake-indexeddb` so the real Dexie path runs under Node |
| Storage | IndexedDB via `dexie`, plus a JSON snapshot file — see [ADR 001](docs/adr-001-document-store.md) |

## Getting started

```bash
npm install
npm run dev          # browser dev loop at http://localhost:5173
npm test             # domain, services, per-screen utils, repository contract, layering
npm run typecheck    # vue-tsc
npm run build        # typecheck + production bundle into dist/
```

### Running on Android

Requires Android Studio (or the Android SDK plus a `local.properties` pointing at it).

```bash
npm run android      # build, sync to the native project, open Android Studio
# or, once the SDK is on PATH:
npm run cap:sync && cd android && ./gradlew assembleDebug
```

The generated debug APK lands in `android/app/build/outputs/apk/debug/`.

## How it is put together

```
views / components  →  utils  →  services  →  domain
stores              →  services (patch builders only)  →  domain  →  Repository
```

Imports point downward only. [`docs/architecture.md`](docs/architecture.md) is the authority on
which layer a piece of code belongs in — read it before adding or moving business logic — and
`src/architecture.spec.ts` asserts the import direction under `npm test`.

```
src/
  domain/      pure logic, no framework and no I/O — effectively frozen, change only with a spec
    currency.ts   every ISO 4217 currency, with symbol and decimal precision
    money.ts      integer minor-unit arithmetic
    fx.ts         manual-rate conversion and frozen rate snapshots
    period.ts     budget cycles (calendar month, payday-anchored, weekly, fortnightly)
    budgeting.ts  budget rollups, goal progress, report aggregation
    format.ts     money and date formatting
    types.ts      entities + the Repository interface
  services/    rules two or more screens share, and every builder of a persisted record;
               pure and synchronous (budgeting, budgets, fx, goals, money, period,
               recurring, settings, transactions)
  data/        db.ts schema (SCHEMA_VERSION), indexeddb.ts (the store of record),
               memory.ts (the test double), snapshot.ts (durability backstop),
               migrations.ts (schema-to-schema transforms), backup.ts (versioned
               restore and merge), backupFile.ts (share / pre-import copy),
               version.ts, fixtures, and the repository contract suite
  stores/      the Pinia store — loaded records, writes, load lifecycle, no calculation;
               repository.ts picks the concrete Repository
  composables/ useBudgetContext — the base currency, rates and period a screen needs
  views/       one folder per screen: <Name>Page.vue plus utils.ts for that screen's logic
  components/  shared UI, same shape (transaction row and modal, currency picker, FX rate
               field, meters, period switcher)
  theme/       CSS tokens and the bundled icon registry
```

Four rules the code holds to:

1. **Money is never a float.** Amounts are integer minor units plus a currency code, at
   that currency's ISO precision — 2 for USD, 0 for JPY, 3 for KWD. Floats appear only when
   parsing what the user typed and when applying a rate, and both round back to integers
   immediately. `src/domain/money.spec.ts` pins this down.
2. **Views never touch storage.** Everything goes through the store and the `Repository`
   interface in `src/domain/types.ts`. `IndexedDbRepository` is the implementation in use;
   `MemoryRepository` stays as the test double, and one contract suite runs against both. The
   swap from one to the other was one line in `src/stores/repository.ts`, with no view changes.
3. **A wallet holds exactly one currency**, and is never silently converted. Money crossing
   currencies needs a rate the user types, and that rate is frozen onto the record — so
   changing a rate later never rewrites history.
4. **Nothing is fetched at runtime.** No rate APIs, no icon CDN, no fonts. An amount that
   cannot be converted for want of a rate is reported as excluded rather than silently
   counted as zero.

## Settings chosen at first run

- **Main currency** — picked during onboarding from the full ISO 4217 list, and drives every
  total and budget figure. Changeable later in Settings.
- **Budget cycle** — calendar month, monthly anchored to a payday, weekly, or fortnightly.

## Not built yet

- Optional passphrase encryption on the backup file — deliberately deferred out of D3
- App lock with fingerprint or PIN (D4) — visible in Settings as a stub
- Google Drive backup and restore (D5)
- Automatic generation of recurring transactions on their due date — the rules and their
  monthly totals are there, and `lastRunDate` is now part of the persisted model, but the
  launch-time generator is not written yet, so "Add now" stands in for it meanwhile
- On-device checks still outstanding: force-close persistence and the 20k-transaction scale
  test on a mid-range phone (both pass in the browser)
