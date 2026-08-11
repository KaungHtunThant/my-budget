# my-budget — Android Salary & Budget App: Draft Plan

## Context

`my-budget` starts as an empty repository. The goal is a personal Android app for managing
a salary: recording income, allocating it to budgets, tracking expenses against those
budgets, and saving toward goals.

The app must be **fully usable offline** — all data lives on the device. The only network
feature is an optional Google Drive backup/restore, which is deliberately deferred to a
later phase so a working local backup exists first.

This document is the agreed plan. Implementation has not started.

---

## Decisions already made

| Question | Decision |
|---|---|
| Scope | Full: salary → budgets → expenses → savings goals |
| Stack | **Ionic Vue + Capacitor** (Vue 3 + TypeScript, real Android APK) |
| Currency | **Multi-currency**, no live rates — user enters the rate manually |
| FX model | Per-currency wallets **and** per-entry conversion |
| Backup | Local file export/import first; Google Drive later |
| Build order | **Frontend prototype first**, approved, *then* data layer |

---

## Stack

- **Vue 3 + TypeScript**, Composition API with `<script setup>`
- **Ionic Framework (Vue)** — mobile UI components, native-feeling navigation, modals, pickers
- **Capacitor** — packages the web app into a real Android APK, provides native plugins
- **SQLite** via `@capacitor-community/sqlite` — a genuine on-device relational DB, not
  browser storage that can be evicted. `jeep-sqlite` provides a browser fallback so the
  app can be developed and tested in a normal browser without an emulator.
- **Pinia** — state management
- **Vite** — build tooling (Ionic's Vue starter uses it by default)
- **Vitest + Vue Test Utils** for unit tests

Rationale: Capacitor keeps the whole app in Vue/TS while still producing an installable
APK, and the SQLite plugin gives durable storage appropriate for financial records.
Nothing in the core app makes a network call.

---

## Architecture

Four layers, kept deliberately separate so the Drive phase and any future platform
(iOS, web) plug in without touching business logic.

```
┌─────────────────────────────────────────────┐
│  Views (Ionic Vue pages + components)       │  screens, forms, charts
├─────────────────────────────────────────────┤
│  Stores (Pinia)                             │  app state, derived totals
├─────────────────────────────────────────────┤
│  Services / domain logic                    │  money math, FX conversion,
│                                             │  allocation, budget rollups,
│                                             │  backup serialization
├─────────────────────────────────────────────┤
│  Repositories → SQLite (Capacitor plugin)   │  queries + schema migrations
└─────────────────────────────────────────────┘
```

Key rules:

- **Views never touch SQL.** Only repositories issue queries.
- **The repository layer is an interface, not a class.** This is what makes
  prototype-first work: the prototype ships a mock in-memory implementation, and the real
  SQLite implementation is swapped in behind the same interface with no view changes.
- **Money is never a float.** Amounts are stored as integer minor units (e.g. cents) plus
  a currency code, with per-currency decimal precision. All arithmetic is integer-based.
- **Backup is a service, not a screen concern.** The same serializer feeds local file
  export and, later, Drive upload — so adding Drive is a new transport, not a rewrite.
- **Schema migrations are versioned from day one**, so upgrades never lose user data.

---

## Data model (entity level)

Entity level only; column-level detail comes with the schema work in D1.

- **Currency** — code, symbol, decimal places, whether it is the base currency
- **Wallet / Account** — a holder of money in exactly one currency (bank, cash, savings)
- **Category** — hierarchical income/expense categories
- **Payslip** — a salary event: date, gross, itemised deductions, net, employer
- **Transaction** — income, expense, or transfer; belongs to a wallet
- **Allocation** — the split of a payslip's net pay across budgets/goals
- **Budget** — a per-period spending limit for a category
- **RecurringRule** — templates for repeating bills and salary
- **SavingsGoal** — target amount, currency, deadline, linked wallet
- **Settings** — base currency, theme, app lock, backup preferences

### Multi-currency handling

Two mechanisms:

1. **Wallets are single-currency.** A wallet's balance is always in its own currency and
   is never silently converted. Transfers between wallets of different currencies prompt
   for a rate and record it on the transfer.
2. **Per-entry conversion.** Any transaction can be entered in a currency other than its
   wallet's — the app asks for the rate at that moment.

Every converted record stores **the original amount, the original currency, the rate used,
and the resulting base-currency amount**. The base amount is a frozen snapshot: changing
the rate later never rewrites history. Reports are shown per currency, with an optional
combined view computed from these stored snapshots.

---

## Features by area

**Salary** — record payslips with gross, deductions and net; see net-pay history and
year-to-date totals; flag raises.

**Allocation** — on payday, split net pay across budget categories and savings goals;
save reusable allocation templates; show unallocated remainder.

**Spending** — quick expense entry (amount, category, wallet, date, note); transfers
between wallets; recurring bills generated from rules.

**Budgets** — monthly limits per category, spent vs remaining, over-budget warnings,
rollover of unspent amounts (optional per budget).

**Savings goals** — target and deadline, contributions from allocations, progress and
projected completion date.

**Dashboard & reports** — current month at a glance, income vs spend, spend by category,
wallet balances, trend over time.

**Settings** — base currency, currency list and precision, categories, recurring rules,
theme, app lock, backup/restore.

---

## Backup strategy

**Phase A — local (built first, always available)**

- Export the entire database to a single portable file (JSON payload plus schema version,
  or a raw `.db` copy) via Capacitor Filesystem and the system share/save sheet. The user
  can save it anywhere — including their own Google Drive through the Android file picker,
  with zero network code in the app.
- Import validates the schema version and offers **merge or replace** before writing.
- Optional passphrase encryption on the export file.

**Phase B — Google Drive (later)**

- Google sign-in, upload the same export payload to Drive's hidden **appDataFolder** so it
  never clutters the user's Drive.
- Manual "Back up now" / "Restore", plus optional periodic auto-backup.
- Requires a Google Cloud OAuth client and the app's release signing certificate
  fingerprint — a setup step to budget for, not a code problem.

---

## Build order: prototype first

Development runs in two stages with an approval gate between them.

### Stage 1 — Frontend prototype (no database)

A clickable, navigable app with every screen built and realistic fake data. It looks and
feels like the finished product, but nothing persists across a restart.

- **Fake data lives behind the real repository interface**, seeded from a fixture file.
  The prototype's store is an in-memory implementation of the same contract SQLite will
  later satisfy — so Stage 2 is a swap, not a rewrite.
- **Domain types and money math are real from the start.** Integer minor units, currency
  precision and FX conversion are written properly in Stage 1 rather than faked, because
  they are cheap to get right early and expensive to retrofit.
- Runs in a browser for fast iteration and on a real device via Capacitor, so the feel of
  navigation and forms can be judged honestly.

| # | Prototype milestone | Outcome |
|---|---|---|
| **P0** | Scaffold | Ionic Vue + TS + Capacitor project, Android platform added, app runs in browser and on device |
| **P1** | Shell & design | Navigation, tab structure, theme, shared components, empty/loading states |
| **P2** | Types & mock layer | Domain types, money/FX utilities, repository interface, in-memory implementation, seed fixtures |
| **P3** | Money screens | Wallets, categories, transaction entry (income/expense/transfer), history list |
| **P4** | Multi-currency UX | Manual rate prompt on cross-currency entry, per-currency and combined views |
| **P5** | Salary & allocation | Payslip entry, net-pay history, payday allocation flow with templates |
| **P6** | Budgets, goals, recurring | Budget screens, savings goals, recurring rule management |
| **P7** | Dashboard & reports | Home dashboard, category breakdown, trends |
| **P8** | Settings & prototype polish | Settings screens, dark mode, icon/splash, installable debug APK for review |

**→ Approval gate: the prototype is reviewed end to end and signed off before any DB work.**

### Stage 2 — Backend and database

Persistence, then backup, then Drive. The UI should barely change.

| # | Milestone | Outcome |
|---|---|---|
| **D0** | SQLite wiring | `@capacitor-community/sqlite` set up, browser fallback for dev, versioned migration framework |
| **D1** | Schema & repositories | Real tables, real repository implementation replacing the mock, seed/reset tooling |
| **D2** | Cut over | Prototype swapped onto the real layer, data survives restart, integrity and correctness tests |
| **D3** | Local backup | Export/import with schema-version validation, merge-or-replace, optional encryption |
| **D4** | Hardening & release | App lock (biometric/PIN), migration testing, performance on large history, signed release APK |
| **D5** | Google Drive backup | OAuth sign-in, appDataFolder upload/restore, optional auto-backup |

P0–P2 are the critical path for Stage 1: the mock layer's shape determines how painless
the D2 cut-over is. D3 is worth pulling forward if real data will be entered before the
app is finished.

---

## Risks and things to watch

- **Prototype-to-database drift** is the main risk of building UI first. It is contained
  by writing the repository interface and the real domain types in P2 — if the mock is
  just loose objects invented per screen, the D2 cut-over becomes a rewrite.
- **SQLite plugin setup** is the fiddliest part of Capacitor: it needs explicit
  initialisation and a separate browser fallback. Getting D0 right de-risks the rest of
  Stage 2.
- **Android storage permissions** changed significantly in recent versions. Using the
  system share/save sheet rather than direct file paths avoids most of this.
- **Drive OAuth** requires Google Cloud console setup and the release keystore's SHA-1
  fingerprint. Debug and release builds need separate registrations.
- **Webview performance** is fine for this app's data volumes, but list virtualisation
  will be needed if transaction history grows into the thousands.
- **Floating-point money bugs** are the classic failure here — the integer-minor-units
  rule exists specifically to prevent them and should be enforced from P2, in the
  prototype, not deferred to the database stage.

---

## Verification

**Stage 1 (prototype)**

- **Browser dev loop** — `npm run dev`, click through every screen against seeded fixtures.
- **On-device review build** — `npx cap run android` on a real phone, plus a shareable
  debug APK, so navigation and form feel are judged on real hardware, not a desktop browser.
- **Unit tests (Vitest)** — money arithmetic, FX conversion, budget rollups and allocation
  splits, all testable against the mock layer with no database present.

**Stage 2 (data)**

- **Cut-over check** — the same screens and the same tests run unchanged against the real
  repository; any test that needed rewriting signals leaked abstraction.
- **Persistence test** — enter data, force-close, reopen, confirm everything survives.
- **Migration test** — install an older build with data, upgrade, confirm nothing is lost.
- **Backup round-trip test** — export, wipe app data, reinstall, restore, verify balances
  and history match exactly.
- **Scale check** — seed a few thousand transactions and confirm list and report
  performance holds in the webview.

---

## Open items to decide before implementation

1. **Base currency and the initial currency list** — which currencies are actually used.
2. **App lock** — biometric/PIN at launch, or none.
3. **Budget period** — calendar month, or a payday-anchored cycle (e.g. 25th to 24th).

---

## Next step

Work starts at **P0** — scaffold the Ionic Vue + Capacitor project — and runs through the
prototype milestones to a reviewable debug APK. No database work begins until that
prototype is approved.
