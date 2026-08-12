/**
 * The single place the app decides which `Repository` implementation it is running on.
 *
 * `IndexedDbRepository` is the store of record on device and in the browser — the same code
 * path in both, which is why no fallback implementation is needed here. `MemoryRepository`
 * is still built and maintained, but as the double the contract tests measure the persistent
 * layer against; see `src/data/repository.contract.spec.ts`.
 *
 * Nothing else in the app changes when this line changes, because everything above depends on
 * the `Repository` interface rather than on a concrete class.
 */

import { IndexedDbRepository } from '@/data/indexeddb'
import type { Repository } from '@/domain/types'

let instance: Repository | null = null

export function getRepository(): Repository {
  if (!instance) instance = new IndexedDbRepository()
  return instance
}

/** Swap the implementation. Used by tests. */
export function setRepository(repo: Repository): void {
  instance = repo
}
