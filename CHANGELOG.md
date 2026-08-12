# Changelog

All notable changes to this project are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

Stage 2 — see [`docs/PLAN.md`](docs/PLAN.md) for the plan.

- Persistence with SQLite behind the existing `Repository` interface
- Local backup export/import, then optional Google Drive sync
- App lock with fingerprint or PIN
- Automatic generation of recurring transactions on their due date

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
