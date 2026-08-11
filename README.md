# My Budget

An offline-first Android app for managing a salary: record payslips, split each payday
across budgets and savings goals, track spending against those budgets, and hold money in
more than one currency.

Everything lives on the device. The app makes no network requests — even its icons and
fonts are bundled — and the only planned online feature is an optional Google Drive backup,
which comes after a local file backup.

**Current status: Stage 1 prototype.** Every screen is built and interactive against
realistic in-memory data. Nothing persists across a reload yet; the database, backup and
Drive sync are Stage 2. See [`docs/PLAN.md`](docs/PLAN.md) for the full plan.

## Stack

| | |
|---|---|
| UI | Vue 3 + TypeScript, Composition API, Ionic Framework (Vue) |
| Native shell | Capacitor 7 → Android APK |
| State | Pinia |
| Build / test | Vite, Vitest |
| Storage | In-memory today; SQLite (`@capacitor-community/sqlite`) in Stage 2 |

## Getting started

```bash
npm install
npm run dev          # browser dev loop at http://localhost:5173
npm test             # unit tests for money, FX, periods and budgeting
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
src/
  domain/      pure logic, no framework and no I/O
    currency.ts   every ISO 4217 currency, with symbol and decimal precision
    money.ts      integer minor-unit arithmetic
    fx.ts         manual-rate conversion and frozen rate snapshots
    period.ts     budget cycles (calendar month, payday-anchored, weekly, fortnightly)
    budgeting.ts  budget rollups, goal progress, payday allocation, report aggregation
    types.ts      entities + the Repository interface
  data/        repository implementations (in-memory today, SQLite next) and fixtures
  stores/      Pinia store — the only thing views talk to
  views/       one file per screen
  components/  shared UI (transaction row, currency picker, meters, modals)
  theme/       CSS tokens and the bundled icon registry
```

Four rules the code holds to:

1. **Money is never a float.** Amounts are integer minor units plus a currency code, at
   that currency's ISO precision — 2 for USD, 0 for JPY, 3 for KWD. Floats appear only when
   parsing what the user typed and when applying a rate, and both round back to integers
   immediately. `src/domain/money.spec.ts` pins this down.
2. **Views never touch storage.** Everything goes through the `Repository` interface in
   `src/domain/types.ts`. `MemoryRepository` implements it now; `SqliteRepository` will
   implement the same interface in Stage 2, so the swap is one line in
   `src/stores/repository.ts`.
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

- Persistence, so data survives a restart (Stage 2, D0–D2)
- Local backup export/import, then Google Drive sync (D3, D5)
- App lock with fingerprint or PIN (D4)
- Automatic generation of recurring transactions on their due date — the rules and their
  monthly totals are there, but generation needs a persisted `lastRunDate` to stay
  idempotent, so "Add now" stands in for it meanwhile
