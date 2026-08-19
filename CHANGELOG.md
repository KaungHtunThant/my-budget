# Changelog

All notable changes to this project are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Data survives closing the app.** IndexedDB (via `dexie`) is the store of record, behind the
  same `Repository` interface the prototype used — the cut-over was one line in
  `src/stores/repository.ts` and no view changed. Indexes on `date`, `walletId`, `toWalletId`,
  `categoryId` and `goalId`; `walletBalance()` now uses two of them instead of scanning every
  transaction once per wallet.
- **JSON snapshot file** as the durability backstop and the export payload, written via
  `@capacitor/filesystem` with temp-then-rename and a `.bak`, debounced and flushed when the app
  is backgrounded. If the object stores ever come up empty, `init()` rebuilds from the file
  instead of starting the user over. Verified by wiping every store and reloading.
- **Repository contract suite** — 35 assertions run identically against `MemoryRepository` and
  `IndexedDbRepository`, which is what makes the swap provably behaviour-preserving. Includes a
  regression test for the Vue-proxy clone trap. `fake-indexeddb` lets the real Dexie path run
  under Vitest. Test count: 63 → 109.
- **A recurring bill or a budget limit can be entered in any currency.** Both forms now offer the
  currency picker the transaction modal had, and both ask for a rate when the amount is not in the
  currency the record has to store — a rule's wallet, a budget's base. The amount is stored
  converted with the conversion frozen beside it, so reopening the form shows what was typed and a
  generated bill reads in history exactly as the same entry made by hand. The entry rule itself is
  one function, `services/fx.resolveEntry`, which `services/transactions` now composes rather than
  duplicating. Two consequences worth naming: a rule paid from a non-base wallet used to store its
  amount in the *base* currency and hand that straight to a wallet transaction, and the monthly
  commitment total summed rule amounts as if they shared a currency — it now converts through the
  settings rates and says which currency it had to leave out.
- **Swipe left or right to change tab.** A horizontal drag on a tab page moves to the next one, with
  the incoming view sliding in from the side swiped from; the dock's new indicator tracks the finger
  and springs back if the swipe is abandoned. No wrap at either end — the ends resist instead. A
  gesture this wide has to know when it is not wanted, so it declines on a presented overlay, on
  anything that owns the pointer itself (sliding rows, FABs, pickers, the refresher) and on any
  horizontally scrollable ancestor, which is what keeps the filter chip strips scrolling. The page
  does *not* follow the finger: tab pages are lazy routes, so the incoming view does not exist to
  drag until the navigation resolves.

### Changed

- **Storage is IndexedDB, not SQLite** — the plan's original choice, reversed now that Stage 1
  showed nothing above the repository issues a query. Rationale, trade-offs and measurements in
  [`docs/adr-001-document-store.md`](docs/adr-001-document-store.md).
- `MemoryRepository` is no longer the app's store; it is the reference implementation the
  contract tests measure against, and its behaviour is now a specification.
- Recurring rules and savings goals are listed by name, matching how wallets and categories
  already were. Previously insertion-ordered, which no longer means anything once records are
  loaded from a store rather than a fixture.
- `Repository` gained one optional method, `saveSnapshot?()`, for flushing on background.

### Removed

- **Salary & payslips**, and the payday allocation that depended on it. Gross pay, itemised
  deductions, payslip history, allocation lines and allocation templates are all gone, along
  with the Salary tab and the "Pay not yet allocated" card on the dashboard. Pay is now
  recorded as an ordinary income transaction in Activity, against the `Salary` category.
  Budgets already express the per-category plan, and goals take contributions directly, so
  the allocation layer earned nothing it did not also complicate.

### Changed

- Savings goals moved from the "More" menu into the tab bar, taking the freed slot:
  Home, Activity, Budgets, Goals, More.
- Onboarding controls are pinned to the bottom of the screen as one fixed bar, with the step
  indicators above them, and the page carries more top and bottom padding.

### Fixed

- Editing an income transaction no longer silently clears its category. The type watcher ran
  after the form loaded and wiped any category that had been set, because loading an income
  row moves `type` off its `expense` default.

### Planned

Remainder of Stage 2 — see [`docs/PLAN.md`](docs/PLAN.md).

- Backup UI: share/save the snapshot, import with merge-or-replace, optional passphrase
  encryption (the payload and file format already exist)
- App lock with fingerprint or PIN
- Automatic generation of recurring transactions on their due date
- Optional Google Drive sync, uploading the same payload
- On-device scale pass: the eager full-collection load, not the store, is what should bind first

## [1.0.0] — 2026-08-11

Stage 1 prototype.

Offline-first Android app for managing a salary: record payslips, split each payday across
budgets and savings goals, track spending, and hold money in more than one currency. Every
screen is built and interactive. Data lives in memory only and does not survive a reload —
persistence is Stage 2.

### Added

- **Onboarding** — pick a main currency from the full ISO 4217 list and a budget cycle
  (calendar month, payday-anchored, weekly, or fortnightly) on first launch
- **Dashboard** with period navigation, net worth, income vs spending, and a category
  breakdown
- **Salary** — payslips with itemised deductions, plus payday allocation across budgets and
  goals from reusable templates
- **Budgets** per category with per-period limits, progress meters, and single-period
  rollover of what went unspent
- **Activity log** with filters, and transaction entry for expense, income and transfer,
  including cross-currency transfers
- **Wallets**, each holding exactly one currency, with per-currency subtotals
- **Savings goals** with target amounts, target dates and contributions
- **Recurring rules** with their monthly cost; "Add now" stands in until generation is
  idempotent against a persisted last-run date
- **Reports** — per-period trend, category breakdown and totals
- **Currencies and rates** — manually entered rates against the main currency
- **Settings**, dark mode, and 14 screens in total

### Domain rules, unit tested across 66 tests

- Money is integer minor units plus a currency code, at each currency's ISO precision — 2
  for USD, 0 for JPY, 3 for KWD. Text parsing scales in digit space, because `1.005 * 100`
  is `100.4999…` in IEEE-754 and would drop a cent
- Rates are entered by hand and frozen onto each record, so editing a rate later never
  rewrites history
- A wallet is never silently converted; money crossing currencies needs a rate
- Aggregates report any currency they could not convert for want of a rate, rather than
  counting it as zero
- Views never touch storage; everything goes through the `Repository` interface in
  `src/domain/types.ts`, so Stage 2 swaps in SQLite behind the same contract

### No network use

The app makes no HTTP request at all. No rate API, no icon CDN, no web fonts — icons are
bundled and looked up by name, and the favicon is inlined.

### Not in this release

- Persistence, so data survives a restart
- Local backup export/import, then optional Google Drive sync
- App lock with fingerprint or PIN
- Automatic generation of recurring transactions on their due date

Built with Vue 3, TypeScript, Ionic 8 and Capacitor 7.
