# ADR 001 — Persist to a document store, not SQLite

- **Status:** accepted, implemented
- **Date:** 2026-08-12
- **Supersedes:** the SQLite decision in [`PLAN.md`](PLAN.md) ("Decisions already made" and
  milestones D0–D2)

## Context

`PLAN.md` chose `@capacitor-community/sqlite` before any code existed, for two stated reasons:
durable storage appropriate to financial records, and "a genuine on-device relational DB, not
browser storage that can be evicted."

Stage 1 is now built, and the app's real data-access shape is visible. It does not use SQL:

- `src/stores/budget.ts` — `reload()` issues six bare `list*()` calls and holds every collection
  in Pinia refs. No query pushdown, no pagination, no partial read.
- Every filter, rollup, trend and report is a pure function over plain arrays in
  `src/domain/budgeting.ts`. There are no joins; relationships resolve through in-memory `Map`s
  (`categoriesById`, `walletsById`, `goalsById`).
- `TransactionQuery` existed in the interface and was implemented in `MemoryRepository`, but **no
  caller ever passed one** — `TransactionsPage` filters `store.transactions` in a computed.
  `getWallet`, `getCategory`, `getTransaction` and `getGoal` were likewise never called.
- `walletBalance()` was the only aggregate, and it was a linear scan.
- The model is already JSON. `src/data/clone.ts` says so: records are "strings, numbers,
  booleans, null, arrays and plain objects". Dates are ISO strings; money is `{ minor, currency }`.

So SQL's query planning, joins and partial reads would go unused, while its costs would not:
explicit plugin initialisation, a separate `jeep-sqlite` WASM path so the app still runs in a
browser, and a hand-written versioned migration framework. `PLAN.md` itself called that setup
"the fiddliest part of Capacitor."

## Decision

**IndexedDB via Dexie is the store of record. A JSON snapshot file is the durability and
portability backstop.**

Plain JSON files alone were considered and rejected on scale. A transaction serialises to 378
bytes, so ten years of heavy use (~18k rows) is ~6.6MB, and every edit would rewrite the whole
collection — O(n) per write, plus marshalling a multi-megabyte string across the Capacitor
bridge. The mitigations (shard by year, load shards lazily, debounce writes, atomic rename,
keep a backup) amount to hand-building a database. IndexedDB already is one.

The snapshot answers the original durability objection structurally rather than by argument.
IndexedDB in a Capacitor webview lives in the app's private storage and is cleared by uninstall
or "Clear storage", not by browser-style eviction — but rather than rest on that, `init()` reads
the snapshot whenever the object stores come up empty and rebuilds from it. The same payload is
the export format that milestone D3 already called for, so the second mechanism is work that was
already on the roadmap.

## Consequences

**Gained**

- No native storage plugin, and one code path in the browser and on device — no `jeep-sqlite`.
- Per-record writes instead of whole-collection rewrites.
- Dexie's versioned `upgrade()` hooks in place of a bespoke migration framework.
- Declared indexes on `date`, `walletId`, `toWalletId`, `categoryId` and `goalId`, which make
  selective loading possible later without a schema change. `walletBalance()` already uses two
  of them instead of scanning every transaction once per wallet.
- Export, import and Drive upload all move the same artefact.

**Given up**

- No SQL for ad-hoc analysis of the stored data. Given every aggregate is a tested pure function
  over arrays, this costs nothing today.
- Two mechanisms rather than one, so a snapshot can lag the object stores by up to its debounce
  window (5s, plus a forced flush when the app is backgrounded). The object stores are always
  authoritative; the file is a backstop, never read unless they are empty.

**Kept**

- The `Repository` interface is unchanged apart from one optional `saveSnapshot?()`. The
  cut-over was a single line in `src/stores/repository.ts`.
- `MemoryRepository` stays, promoted from prototype scaffolding to the in-memory double that
  `src/data/repository.contract.spec.ts` measures the persistent layer against. Both
  implementations pass the same 35 assertions, which is the evidence that swapping them cannot
  change what the app shows.

## Validation

Measured in Chromium on the dev machine — a mid-range Android device should be assumed several
times slower, and the on-device numbers are what milestone D4 should re-check.

| Check | Result |
|---|---|
| Contract suite, both implementations | 35 assertions each, identical |
| Full suite | 109 tests pass |
| Reload with data present | Lands on `/tabs/home`, all seven stores intact |
| Wipe every object store, then reload | Rebuilt from the snapshot: 35/35 transactions restored |
| Snapshot size, demo data | 15.2 KB |
| Eager load, 20,035 transactions | 147 ms |
| One cycle via the `date` index | 1,667 rows in 18.7 ms — ~8× the eager path |
| One wallet via the `walletId` index | 5,029 rows in 43 ms |
| `JSON.stringify` of 20k rows (5.5 MB) | 28 ms, so snapshots stay cheap at scale |
| Cold boot to dashboard, 20k rows | ~1.1 s |

The eager-load pattern, not IndexedDB, is what will eventually bind: at 20k rows the read is
147 ms but the boot is ~1.1 s. The indexes exist so that when it does bind, the fix is a query
rather than a migration.

## Notes for later

- Vue reactive proxies cannot be structured-cloned, and IndexedDB clones on write, so every write
  path calls `deepClone` first. A shallow spread is not enough — nested money objects stay
  proxied. `repository.contract.spec.ts` has a regression test that fails without it.
- Android auto-backup may or may not capture webview storage. Do not rely on it; the explicit
  snapshot and the D3 export are the supported paths.
