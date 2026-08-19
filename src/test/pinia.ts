/**
 * Store test harness.
 *
 * Two ordering constraints are load-bearing and easy to get wrong by hand, which is why this
 * helper exists rather than being inlined per spec:
 *
 * 1. `setRepository` must run *before* `useBudgetStore()`. The store resolves its repository
 *    once, in the `defineStore` setup body — swapping the implementation afterwards leaves the
 *    store talking to whatever was installed when it was first created.
 * 2. Each test needs a fresh Pinia. A store is cached per Pinia instance, so reusing one leaks
 *    the previous test's loaded records into the next.
 *
 * `MemoryRepository` is used deliberately over the IndexedDB one: it needs no `fake-indexeddb`,
 * no async open, and no teardown, and the contract suite already proves the two behave alike.
 */

import { createPinia, setActivePinia } from 'pinia'

import { MemoryRepository } from '@/data/memory'
import { useBudgetStore } from '@/stores/budget'
import { setRepository } from '@/stores/repository'

/**
 * A freshly loaded store backed by an in-memory repository.
 *
 * @param seeded When true (the default) the demo fixture is loaded, so derived values have
 *   something to derive from. Pass false for an empty-state test.
 */
export async function createTestStore(
  seeded = true,
): Promise<ReturnType<typeof useBudgetStore>> {
  setActivePinia(createPinia())
  setRepository(new MemoryRepository(seeded))
  const store = useBudgetStore()
  await store.init()
  return store
}
