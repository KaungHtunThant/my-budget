/**
 * The single place the app decides which `Repository` implementation it is running on.
 *
 * In Stage 2 this becomes: use `SqliteRepository` on device and in the browser via the
 * jeep-sqlite fallback. Nothing else in the app changes, because everything above depends
 * on the `Repository` interface rather than on a concrete class.
 */

import { MemoryRepository } from '@/data/memory'
import type { Repository } from '@/domain/types'

let instance: Repository | null = null

export function getRepository(): Repository {
  if (!instance) instance = new MemoryRepository()
  return instance
}

/** Swap the implementation. Used by tests, and by the Stage 2 cut-over. */
export function setRepository(repo: Repository): void {
  instance = repo
}
