# my-budget — Android Salary & Budget App: Draft Plan

## Context

`my-budget` starts as an empty repository. The goal is a personal Android app for managing
a salary: recording income, allocating it to budgets, tracking expenses against those
budgets, and saving toward goals.

The app must be **fully usable offline** — all data lives on the device. The only network
feature is an optional Google Drive backup/restore, which is deliberately deferred to a
later phase so a working local backup exists first.

This document is the agreed plan.

> **Amended 2026-08-12.** Stage 1 shipped, and two decisions recorded below have since changed
> in light of it. Storage is **IndexedDB plus a JSON snapshot file, not SQLite** — see
> [`adr-001-document-store.md`](adr-001-document-store.md) for the evidence and the trade. And
> salary/payslips with payday allocation were **removed** as more machinery than the app needed;
> pay is recorded as ordinary income. [`features.md`](features.md) is the live scope document.
> Sections below are marked where they are superseded.

---

## Decisions already made

| Question | Decision |
|---|---|
| Scope | ~~Full: salary → budgets → expenses → savings goals~~ → income → budgets → expenses → savings goals (salary module removed) |
| Stack | **Ionic Vue + Capacitor** (Vue 3 + TypeScript, real Android APK) |
| Currency | **Multi-currency**, no live rates — user enters the rate manually |
| FX model | Per-currency wallets **and** per-entry conversion |
| Backup | Local file export/import first; Google Drive later |
| Build order | **Frontend prototype first**, approved, *then* data layer |
| Storage | ~~SQLite~~ → **IndexedDB (Dexie) + JSON snapshot file** — see [ADR 001](adr-001-document-store.md) |

---

## Stack

- **Vue 3 + TypeScript**, Composition API with `<script setup>`
- **Ionic Framework (Vue)** — mobile UI components, native-feeling navigation, modals, pickers
- **Capacitor** — packages the web app into a real Android APK, provides native plugins
- **IndexedDB** via `dexie`, with a JSON snapshot file via `@capacitor/filesystem` — no native
  storage plugin, and the same code path in a browser and on device. Superseded the original
  SQLite choice once Stage 1 showed nothing above the repository issues a query; see
  [ADR 001](adr-001-document-store.md).
- **Pinia** — state management
- **Vite** — build tooling (Ionic's Vue starter uses it by default)
- **Vitest + Vue Test Utils** for unit tests, with `fake-indexeddb` so the real Dexie code path
  runs under Node

Rationale: Capacitor keeps the whole app in Vue/TS while still producing an installable
APK. Storage is durable without a native plugin: the object stores live in the app's private
webview storage, and the snapshot file in its private data directory is what the app rebuilds
from if they are ever cleared. Nothing in the core app makes a network call.

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
│                                             │  budget rollups,
│                                             │  backup serialization
├─────────────────────────────────────────────┤
│  Repositories → IndexedDB (Dexie)           │  object stores + indexes,
│                 + JSON snapshot file        │  versioned upgrades, backstop
└─────────────────────────────────────────────┘
```

Key rules:

- **Views never touch storage.** Only repositories read and write it.
- **The repository layer is an interface, not a class.** This is what made prototype-first
  work: the prototype shipped an in-memory implementation, and the persistent one was swapped
  in behind the same interface — one line in `src/stores/repository.ts`, no view changes. The
  in-memory implementation stayed on as the double the contract tests measure against.
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

D0–D2 were replaced by N0–N3 when storage moved off SQLite ([ADR 001](adr-001-document-store.md)).
The outcome is the same: data survives restart, behind the unchanged `Repository` interface.

| # | Milestone | Outcome | Status |
|---|---|---|---|
| **N0** | Store wiring | `dexie` + `@capacitor/filesystem`, schema v1 with indexes, `fake-indexeddb` in Vitest | Done |
| **N1** | Repository & contract tests | `IndexedDbRepository` implementing the full interface; one contract suite asserted against it and `MemoryRepository` alike | Done |
| **N2** | Cut over | One line in `src/stores/repository.ts`; data survives a reload | Done |
| **N3** | Snapshot backstop | JSON snapshot with temp-then-rename and `.bak`, debounced plus flushed on background, rebuild-on-empty in `init()` | Done |
| **D3** | Local backup UI | Share/save the snapshot payload, import with conflict-aware merge-or-replace | Next |
| **D4** | Hardening & release | App lock (biometric/PIN), upgrade testing, on-device performance on large history, signed release APK |  |
| **D5** | Google Drive backup | OAuth sign-in, appDataFolder upload/restore, optional auto-backup |  |

N3 delivered the snapshot *format and file*; D3 is the user-facing half — export, share and
import. That split is why D3 is now small.

### D3 scope, decided 2026-08-20

N3 left more of D3 built than the table suggests: `IndexedDbRepository.exportSnapshot()` already
produces the portable payload, and the private `load(seed)` that rebuild-on-empty uses is already
the replace primitive. What is actually missing is the interface surface, the merge rule, the
validation, and the transports.

- **Passphrase encryption is deferred** out of D3 into its own item (17.3). The round-trip test is
  worth doing against a readable file first, and the format only needs an envelope field when
  encryption actually lands.
- **Import detects conflicts before asking anything.** A dry-run compares the incoming payload
  against what is on the device and reports what would be added, what is identical, and what
  collides on id with differing content. If nothing collides, merge is unambiguous and just
  applies. If something does, the user picks **once** for the whole import — incoming wins, or
  device wins — rather than adjudicating record by record. Replace stays available as the
  separate, stronger action.
- **Export leaves via `@capacitor/share`** and the native save/share sheet; **import arrives via a
  plain `<input type="file">`**, which works in the webview and in a desktop browser, so the whole
  import path stays testable without a device. One new dependency, not two.
- **A snapshot from a newer `SCHEMA_VERSION` is refused**, per the versioning rule below — never
  guessed at.
- **14.5 "reload sample data" is removed**; **14.6 "start empty" stays** as a genuinely destructive
  action with a stronger confirmation, alongside export and import. Loading fake data over real
  data has no purpose worth the risk.

Work order: pure validation and merge-planning functions with tests → `exportSnapshot` and
`importSnapshot` onto the `Repository` interface, `MemoryRepository` and the contract suite → store
actions → the Settings UI and its confirmations → docs.

**Versioning rule.** `SCHEMA_VERSION` in `src/data/db.ts` is the on-disk contract. Every schema
change bumps the Dexie version with an `upgrade()` hook, and the snapshot carries the version so
an import can be transformed forward. A snapshot from a newer schema is refused, not guessed at.

---

## Risks and things to watch

- **Prototype-to-database drift** is the main risk of building UI first. It is contained
  by writing the repository interface and the real domain types in P2 — if the mock is
  just loose objects invented per screen, the D2 cut-over becomes a rewrite.
- ~~**SQLite plugin setup** is the fiddliest part of Capacitor~~ — avoided outright by moving
  to IndexedDB, which needs no native plugin and no browser fallback. In its place: **webview
  storage durability**. The object stores are app-private and are not evicted browser-style,
  but that is the one claim to confirm on a real device rather than assume, which is what the
  snapshot file and its rebuild-on-empty path exist to make survivable either way.
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
- **Unit tests (Vitest)** — money arithmetic, FX conversion, budget rollups, all testable
  against the in-memory layer with no database present.

**Stage 2 (data)** — results in [ADR 001](adr-001-document-store.md).

- **Cut-over check** ✅ — the 63 Stage 1 domain tests passed unchanged against the persistent
  repository; none needed rewriting, so nothing had leaked.
- **Contract check** ✅ — one suite of 35 assertions passes identically against
  `MemoryRepository` and `IndexedDbRepository`.
- **Persistence test** ✅ in browser — enter data, reload, everything survives. Still to do on
  device: force-close and reopen.
- **Backstop test** ✅ — wipe every object store, reload, confirm the app rebuilds from the
  snapshot rather than starting the user over.
- **Scale check** ✅ at 20k transactions in Chromium — 147 ms eager read, 18.7 ms for one cycle
  through the `date` index, ~1.1 s cold boot. Still to do on a mid-range device, where the
  eager-load path, not the store, is expected to bind first.
- **Upgrade test** — once a second schema version exists: install with data, upgrade, confirm
  nothing is lost.
- **Backup round-trip test** — D3: export, clear app data, reinstall, import, verify balances
  and history match exactly.

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
