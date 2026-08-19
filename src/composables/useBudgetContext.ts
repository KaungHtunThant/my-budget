/**
 * The two derived values almost every screen needs, wired once.
 *
 * This is the only file in `src/composables/`, and that is a policy rather than an accident —
 * `src/architecture.spec.ts` asserts it, and adding a second requires an ADR in `docs/`.
 *
 * It exists because `ctx` and `period` are needed by most screens and neither is stored: the
 * store keeps the raw offset and the settings, and services derive the rest. Repeating both
 * `computed`s in eight views would duplicate the clock read as much as the wiring, and it is the
 * single easiest thing for a new screen to get subtly wrong now that `store.period` is gone.
 *
 * It holds no logic of its own — both bodies are single service calls. Anything more than that
 * belongs in a service or a screen's `utils.ts`.
 */

import { type ComputedRef, computed } from 'vue'

import type { BaseContext } from '@/domain/budgeting'
import { type Period, todayIso } from '@/domain/period'
import { baseContext } from '@/services/budgeting'
import { selectedPeriod } from '@/services/period'
import { useBudgetStore } from '@/stores/budget'

export function useBudgetContext(): {
  ctx: ComputedRef<BaseContext>
  period: ComputedRef<Period>
} {
  const store = useBudgetStore()

  return {
    ctx: computed(() => baseContext(store.settings)),
    period: computed(() => selectedPeriod(store.settings, store.periodOffset, todayIso())),
  }
}
