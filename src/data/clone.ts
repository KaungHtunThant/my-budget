/**
 * Deep copy for records crossing the repository boundary.
 *
 * `structuredClone` cannot be used here: values arriving from the UI are wrapped in Vue's
 * reactive Proxy, and cloning a Proxy throws `DataCloneError`. This walks the structure
 * instead, which reads through proxies transparently and yields plain objects.
 *
 * Domain records are deliberately JSON-shaped — strings, numbers, booleans, null, arrays
 * and plain objects — so a structural walk is sufficient.
 *
 * This is now load-bearing rather than defensive: IndexedDB serialises with the structured
 * clone algorithm, which rejects proxies outright, so every repository write runs through
 * here first. A shallow spread is not enough — nested money objects stay proxied.
 */
export function deepClone<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value

  if (Array.isArray(value)) {
    return value.map((item) => deepClone(item)) as unknown as T
  }

  const out: Record<string, unknown> = {}
  for (const key of Object.keys(value as Record<string, unknown>)) {
    out[key] = deepClone((value as Record<string, unknown>)[key])
  }
  return out as T
}
