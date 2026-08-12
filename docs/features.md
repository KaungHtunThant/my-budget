# my-budget — Feature Inventory

This is what the Stage 1 prototype actually does, one line per function point, grouped by
module. It exists to be **marked up**: strike out what should not be built for real, add what
is missing. The surviving list becomes the scope the database stage has to persist.

**How to review.** Refer to items by ID — "drop 9.2–9.5", "keep only 12.1 and 12.2", "add: X".
IDs are stable and are never renumbered, so a removed item simply leaves a gap.

**Status.**

| Status | Meaning |
|---|---|
| `Built` | Implemented and working against the in-memory store. |
| `Stub` | Visible in the app but deliberately inert — a placeholder for a later build. |
| `Planned` | Named in the plan, absent from the app. |

**Standing limitation.** Nothing persists across a reload today. Every `Built` item below works
only until the app restarts — persistence is the next stage, and is what this pruning decides
the size of.

---

## 1. Onboarding & first run

*First-launch flow. The base currency is chosen here and every amount in the app depends on it.*

| ID | Function point | Status |
|---|---|---|
| 1.1 | Welcome screen summarising what the app does | Built |
| 1.2 | Choose the main currency from a searchable list of 157 currencies | Built |
| 1.3 | See the chosen currency's decimal precision before committing to it | Built |
| 1.4 | Choose the budget cycle: calendar month, monthly from a chosen day, weekly, or fortnightly | Built |
| 1.5 | Live preview of the resulting cycle's dates while choosing | Built |
| 1.6 | Opt in or out of sample data (four wallets, budgets, goals, three months of history) | Built |
| 1.7 | Step back and forward through setup; first run is forced and cannot be re-entered afterwards | Built |

**Depends on:** nothing. **Everything else depends on 1.2** — no amount can be displayed
without a base currency.

---

## 2. Home dashboard

*The landing tab. Read-only summaries plus quick entry.*

| ID | Function point | Status |
|---|---|---|
| 2.1 | Total balance across all wallets, converted to the main currency | Built |
| 2.2 | Warning when a currency has no rate and is therefore excluded from the total, with a shortcut to fix it | Built |
| 2.3 | Per-wallet balance chips | Built |
| 2.4 | Cycle switcher — previous, next, tap to return to the current cycle | Built |
| 2.5 | Income, spending and net for the selected cycle | Built |
| 2.6 | Days left in the current cycle | Built |
| ~~2.7~~ | ~~"Pay not yet allocated" card with a shortcut into the allocation flow~~ | Removed with §9 |
| 2.8 | Budget summary — spent of budgeted, with remaining | Built |
| 2.9 | Top three budgets with progress bars | Built |
| 2.10 | Pace marker on progress bars showing where you should be this far into the cycle | Built |
| 2.11 | Six-cycle income-versus-spending bar chart | Built |
| 2.12 | Top savings goals with progress and the per-cycle amount needed to stay on track | Built |
| 2.13 | Recent activity list, tap a row to edit | Built |
| 2.14 | Add a transaction from anywhere via the floating button; pull down to refresh | Built |

**Depends on:** wallets (§3) for 2.1–2.3, budgets (§7) for 2.8–2.10, goals (§10) for 2.12. Each
section degrades independently — remove budgets and 2.8–2.10 vanish without breaking the rest.

---

## 3. Wallets

*A wallet holds money in exactly one currency: a bank account, cash, a savings pot.*

| ID | Function point | Status |
|---|---|---|
| 3.1 | List wallets with type icon, currency, opening balance and current balance | Built |
| 3.2 | Net worth across wallets, with a note naming any currency excluded for want of a rate | Built |
| 3.3 | Totals grouped per currency, so each holding is also visible on its own terms | Built |
| 3.4 | Create a wallet: name, type (bank, cash, savings, card, other), currency, opening balance | Built |
| 3.5 | Opening balance, so balances are correct from day one without entering past history | Built |
| 3.6 | Edit a wallet — the currency is locked after creation, since every stored balance is in it | Built |
| 3.7 | Archive a wallet: hidden from lists, history retained | Built |
| 3.8 | Delete a wallet, which also deletes its transactions | Built |

**Depends on:** the main currency (1.2). **Required by:** every transaction, payslip, goal and
recurring rule — all of them name a wallet. This module cannot be removed.

---

## 4. Activity list & filtering

*The transaction history tab.*

| ID | Function point | Status |
|---|---|---|
| 4.1 | Transactions grouped by date, newest first, with a per-day net figure | Built |
| 4.2 | Each row shows category or transfer direction, wallet, note and signed amount | Built |
| 4.3 | Search notes and categories as you type | Built |
| 4.4 | Filter by type: expense, income, transfer | Built |
| 4.5 | Filter by wallet | Built |
| 4.6 | Filter by category | Built |
| 4.7 | Switch between the selected cycle and all time | Built |
| 4.8 | Active filters shown as chips, each dismissable; reset all at once | Built |
| 4.9 | Tap any row to edit it | Built |

**Depends on:** transaction entry (§5), wallets (§3), categories (§6).

---

## 5. Transaction entry

*The single form for recording money moving, used from every screen.*

| ID | Function point | Status |
|---|---|---|
| 5.1 | Record an expense | Built |
| 5.2 | Record income | Built |
| 5.3 | Record a transfer between two wallets | Built |
| 5.4 | Amount, wallet, category, date and free-text note | Built |
| 5.5 | Amount entry respects the currency's decimal precision, rounding anything finer | Built |
| 5.6 | Category list narrows to income or expense categories to match the type | Built |
| 5.7 | Enter an amount in a currency other than the wallet's | Built |
| 5.8 | Prompt for the exchange rate whenever money crosses currencies | Built |
| 5.9 | Preview of the converted amount before saving | Built |
| 5.10 | The rate used is stored on the transaction and never re-valued when rates change later | Built |
| 5.11 | Cross-currency transfers credit the destination wallet with its own converted amount | Built |
| 5.12 | Edit or delete an existing transaction | Built |

**Depends on:** wallets (§3), categories (§6) for 5.1–5.2, exchange rates (§13) for 5.7–5.11.
**Removing 5.7–5.11 removes multi-currency entry** but leaves multi-currency wallets (3.4)
intact.

---

## 6. Categories

*How spending and income get grouped for budgets and reports.*

| ID | Function point | Status |
|---|---|---|
| 6.1 | Separate income and spending lists | Built |
| 6.2 | Fifteen sensible categories on every new install, demo data or not | Built |
| 6.3 | Each category's total for the selected cycle shown beside it | Built |
| 6.4 | Create and rename categories | Built |
| 6.5 | Choose an icon per category | Built |
| 6.6 | Choose a colour per category, used consistently in charts and progress bars | Built |
| 6.7 | Delete a category — its transactions are kept and become uncategorised | Built |

**Required by:** budgets (§7), the category breakdown (12.3–12.5), allocation targets (9.x).

*Note: the data model supports sub-categories (each category can name a parent), but no screen
exposes it. Flag if hierarchy should be built or dropped from the model.*

---

## 7. Budgets

*A spending limit per category, per cycle.*

| ID | Function point | Status |
|---|---|---|
| 7.1 | Set a limit on a category for the cycle | Built |
| 7.2 | Budgeted, spent and remaining totals across all budgets | Built |
| 7.3 | Per-category progress bar with spent-of-limit figures | Built |
| 7.4 | Pace marker showing whether spending is ahead of the cycle's elapsed time | Built |
| 7.5 | Over-limit budgets highlighted and counted | Built |
| 7.6 | Roll unspent room into the next cycle, optional per budget | Built |
| 7.7 | Rolled-over amount shown explicitly on the row that received it | Built |
| 7.8 | Browse budgets for past and future cycles | Built |
| 7.9 | Edit or delete a budget | Built |

**Depends on:** categories (§6), transactions (§5), the cycle setting (1.4 / 14.3). Limits are
held in the main currency; spending in another currency is converted using each transaction's
stored rate.

---

## 8. ~~Salary & payslips~~ — REMOVED

*Cut deliberately: a payslip with itemised deductions was more machinery than the app needed.
Pay is now recorded like any other income — an income transaction in Activity (§5), against the
`Salary` category, into the wallet it landed in.*

| ID | Function point | Status |
|---|---|---|
| ~~8.1~~ | ~~Record a payslip: employer, date paid, wallet paid into, gross pay~~ | Removed |
| ~~8.2~~ | ~~Itemise deductions with a label and amount each~~ | Removed |
| ~~8.3~~ | ~~Add and remove deduction rows freely~~ | Removed |
| ~~8.4~~ | ~~Running total of deductions and resulting net pay while entering~~ | Removed |
| ~~8.5~~ | ~~Saving a payslip also records its net pay as income into the chosen wallet~~ | Removed |
| ~~8.6~~ | ~~Payslip history, newest first, expandable to show the full breakdown~~ | Removed |
| ~~8.7~~ | ~~Year-to-date net, gross, total deductions and payslip count~~ | Removed |
| ~~8.8~~ | ~~Pay rise or drop flagged against the previous payslip~~ | Removed |
| ~~8.9~~ | ~~Free-text note per payslip~~ | Removed |
| ~~8.10~~ | ~~Delete a payslip, which also removes its income transaction and allocation~~ | Removed |

**Replaced by:** income entry (5.1) plus the `Salary` category (§6). Gross pay and deductions are
no longer modelled at all — only the net amount that actually arrived. If a deduction breakdown
is wanted again later, it returns as a new section, not by reviving these IDs.

---

## 9. ~~Payday allocation~~ — REMOVED

*Cut with §8, which it could not exist without: every allocation line hung off a payslip.
Budgets (§7) already express the plan for a cycle, and goals (§10) take contributions directly.*

| ID | Function point | Status |
|---|---|---|
| ~~9.1~~ | ~~Split a payslip's net pay across any number of lines~~ | Removed |
| ~~9.2~~ | ~~Target a spending category or a savings goal per line~~ | Removed |
| ~~9.3~~ | ~~Enter a line as a fixed amount~~ | Removed |
| ~~9.4~~ | ~~Enter a line as a percentage of net pay, resolved at allocation time~~ | Removed |
| ~~9.5~~ | ~~Resolved amount shown next to each percentage line~~ | Removed |
| ~~9.6~~ | ~~Allocated total, remainder and percentage-of-pay progress~~ | Removed |
| ~~9.7~~ | ~~Over-commitment detected and warned about~~ | Removed |
| ~~9.8~~ | ~~Unallocated pay surfaced on the home and salary screens~~ | Removed |
| ~~9.9~~ | ~~Save an allocation as a reusable template~~ | Removed |
| ~~9.10~~ | ~~Start a new allocation from a saved template~~ | Removed |
| ~~9.11~~ | ~~Re-edit an existing allocation; saving replaces the previous one~~ | Removed |

**Replaced by:** budgets (§7) for the per-category plan, and direct goal contributions (10.5).

---

## 10. Savings goals

*A target amount, optionally with a deadline.*

| ID | Function point | Status |
|---|---|---|
| 10.1 | Create a goal: name, target amount, wallet it accumulates in, optional target date | Built |
| 10.2 | Choose an icon per goal | Built |
| 10.3 | Progress bar with saved, target and remaining figures | Built |
| 10.4 | Amount needed per cycle to hit the target date | Built |
| 10.5 | Contribute to a goal directly, choosing the source wallet | Built |
| 10.6 | Contributions recorded as a transfer, so the money stays visible in balances | Built |
| ~~10.7~~ | ~~Receive contributions from a payday allocation~~ | Removed with §9 |
| 10.8 | Completed goals listed separately from active ones | Built |
| 10.9 | Edit or delete a goal; its past contributions are kept | Built |

**Depends on:** wallets (§3). Contributions now arrive only via 10.5.

---

## 11. Recurring rules

*Templates for bills and regular income.*

| ID | Function point | Status |
|---|---|---|
| 11.1 | Define a repeating bill or income: name, amount, wallet, category | Built |
| 11.2 | Repeat weekly, fortnightly, monthly or yearly | Built |
| 11.3 | Choose the day of month (capped at 28 so it fires every month) or the weekday | Built |
| 11.4 | Monthly-equivalent commitment total across all rules, split into bills and income | Built |
| 11.5 | Plain-English description of each rule's schedule | Built |
| 11.6 | Pause and resume a rule without deleting it | Built |
| 11.7 | "Add now" — record one occurrence immediately | Built |
| 11.8 | Swipe a row for quick actions | Built |
| 11.9 | Edit or delete a rule | Built |
| 11.10 | Generate transactions automatically when a rule falls due | Planned |

**Depends on:** wallets (§3), categories (§6). 11.10 needs persistence and a launch-time check —
it is the one item here that cannot exist without the database.

---

## 12. Reports

*Where the money went.*

| ID | Function point | Status |
|---|---|---|
| 12.1 | Income, spending and net for the selected cycle | Built |
| 12.2 | Savings rate as a percentage, colour-coded | Built |
| 12.3 | Donut chart of spending by category | Built |
| 12.4 | Ranked category list with amount, share of total and transaction count | Built |
| 12.5 | Note naming any currency excluded from the breakdown for want of a rate | Built |
| 12.6 | Six-cycle trend of income, spending and net | Built |
| 12.7 | Averages per cycle across cycles with activity | Built |
| 12.8 | Browse any past cycle | Built |

**Depends on:** transactions (§5), categories (§6). Read-only throughout — nothing here creates
or changes data.

---

## 13. Currencies & exchange rates

*Manual rates. The app makes no network requests, so no rate is ever fetched.*

| ID | Function point | Status |
|---|---|---|
| 13.1 | Searchable picker over 157 currencies, by code or name | Built |
| 13.2 | Your currencies and a popular shortlist offered before the full list | Built |
| 13.3 | Per-currency decimal precision respected everywhere amounts are entered or shown | Built |
| 13.4 | Add a currency to your active list; currencies used by a wallet appear automatically | Built |
| 13.5 | Set a manual rate per currency against the main currency | Built |
| 13.6 | Worked example shown under each rate as it is typed | Built |
| 13.7 | Currencies held in a wallet but missing a rate are flagged wherever a combined total is shown | Built |
| 13.8 | Remove a currency that is not in use | Built |

**Required by:** every combined total (2.1, 3.2, 12.3) and cross-currency entry (5.7–5.11).
**Removing this module makes the app single-currency** — which would also retire 3.3, 5.7–5.11,
2.2, 12.5 and the base-currency change warning (14.1).

---

## 14. Settings

| ID | Function point | Status |
|---|---|---|
| 14.1 | Change the main currency, with a warning that budget and goal figures keep their numbers and will now read as the new currency | Built |
| 14.2 | Reach currencies and rates, with a badge counting missing rates | Built |
| 14.3 | Change the budget cycle, with a live preview of the resulting dates | Built |
| 14.4 | Theme: follow system, light, or dark | Built |
| 14.5 | Reload sample data | Built (prototype-only) |
| 14.6 | Start empty and run first-time setup again, behind a confirmation | Built (prototype-only) |
| 14.7 | App lock with fingerprint or PIN | Stub |
| 14.8 | Export all data to a file | Planned |
| 14.9 | Import from a file, choosing merge or replace | Planned |
| 14.10 | Google Drive backup and restore | Planned |

**14.5 and 14.6 exist because there is no database.** Once data is real, "start empty" becomes a
destructive action needing a stronger confirmation, and "reload sample data" arguably should not
ship at all. Decide their fate rather than inheriting them.

---

## 15. Shell, navigation & shared UI

*Cross-cutting behaviour, not a screen.*

| ID | Function point | Status |
|---|---|---|
| 15.1 | Five-tab layout: Home, Activity, Budgets, Goals, More | Built |
| 15.2 | "More" menu reaching wallets, categories, recurring, reports, currencies, settings | Built |
| 15.3 | Cycle switcher shared by every screen that shows a period, with one selection across all of them | Built |
| 15.4 | Purposeful empty states with a call to action on every list | Built |
| 15.5 | Amounts rendered consistently — tabular figures, correct symbol and precision, optional colour by direction | Built |
| 15.6 | Compact amounts (1.2k, 3.4M) where space is tight | Built |
| 15.7 | Dark mode, following the system or forced | Built |
| 15.8 | App icon and splash screen; installable debug APK | Built |

---

## 16. Money & cycle foundations

*Not user-visible, but decisions here constrain everything above.*

| ID | Function point | Status |
|---|---|---|
| 16.1 | All amounts held as whole numbers of the currency's smallest unit — no floating-point money | Built |
| 16.2 | Per-currency precision: 0 decimals for yen, 2 for dollars, 3 for dinar | Built |
| 16.3 | 157 currencies with name, symbol and precision, bundled — no network lookup | Built |
| 16.4 | Combining two different currencies without an explicit rate is refused, not silently allowed | Built |
| 16.5 | Rates frozen onto each record at entry, so editing a rate never rewrites history | Built |
| 16.6 | Incomplete totals reported as incomplete rather than defaulting a missing rate to 1 | Built |
| 16.7 | Four cycle shapes, all producing a date range budgets and reports filter on | Built |
| 16.8 | Cycle rollover of unspent budget room, computed across past cycles | Built |
| 16.9 | Dates held as plain calendar dates with no timezone, so the 3rd is the 3rd anywhere | Built |
| 16.10 | 63 unit tests over money, rates, cycles and budget rollups | Built |

**Nothing here is proposed for removal** — this is the layer the plan deliberately built early
because it is expensive to retrofit. Listed so it is visible when scoping the database work.

---

## 17. Not built yet

| ID | Function point | Status |
|---|---|---|
| 17.1 | Data survives closing the app | Planned |
| 17.2 | Export to a single portable file, and import it back | Planned |
| 17.3 | Optional passphrase encryption on the export | Planned |
| 17.4 | Google Drive backup, manual and optionally periodic | Planned |
| 17.5 | App lock with fingerprint or PIN at launch | Planned |
| 17.6 | Automatic generation of recurring transactions on their due date | Planned |

17.1 is the whole point of the next stage; the rest are the plan's later milestones. Reorder or
cut these too — they are as much in scope for this review as the built features.

---

## Open questions worth answering while pruning

1. **Sub-categories** — supported in the data model, absent from the UI (see §6). Build, or
   remove from the model before it becomes schema?
2. ~~**Allocation as plan versus movement**~~ — moot: §9 is removed.
3. **Transfers** (5.3) are the most complex entry path and the least used in most budgeting
   apps. Worth confirming they earn their place.
4. **Six-cycle windows** (2.11, 12.6) are fixed. Configurable, or fine as they are?
