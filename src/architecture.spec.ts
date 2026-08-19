/**
 * The layering rules, asserted rather than documented.
 *
 * `docs/architecture.md` states the policy; this file is what keeps it true. There is no linter
 * in this project, and adding one would buy less than it costs here: an import-restriction
 * plugin still cannot express "no `useBudgetStore` outside a `.vue`" or "every `utils.ts` has a
 * spec", which are the rules most likely to be broken. Testing structure is also not new here —
 * `src/data/repository.contract.spec.ts` already asserts that two implementations agree.
 *
 * **This suite is a ratchet.** It starts with the assertions that already hold and gains one at
 * the end of each refactor phase. Two are deliberately absent until their phase lands, and are
 * marked TODO below — an assertion that fails on `main` teaches people to ignore the file.
 *
 * **The `utils.ts` filename is load-bearing.** These globs key off it. Renaming those files
 * silently disables the purity checks rather than failing them.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

import { describe, expect, it } from 'vitest'

// Vitest runs with the project root as cwd; `import.meta.url` is not a file URL under jsdom.
const SRC = join(process.cwd(), 'src')

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

const ALL = walk(SRC).map((f) => relative(SRC, f).split('\\').join('/'))

const read = (path: string): string => readFileSync(join(SRC, path), 'utf8')

/** Every module specifier in a file: static imports, side-effect imports and dynamic imports. */
function importsOf(path: string): string[] {
  const source = read(path)
  const found: string[] = []
  for (const match of source.matchAll(/(?:\bfrom|\bimport)\s*\(?\s*['"]([^'"]+)['"]/g)) {
    found.push(match[1])
  }
  return found
}

const isSpec = (path: string): boolean => path.endsWith('.spec.ts')
const inDir = (path: string, dir: string): boolean => path.startsWith(`${dir}/`)

/** Non-spec TypeScript sources under a directory. */
const sourcesIn = (dir: string): string[] =>
  ALL.filter((f) => inDir(f, dir) && f.endsWith('.ts') && !isSpec(f))

/** Every per-screen logic file, wherever it lives. */
const utilsFiles = (): string[] =>
  ALL.filter((f) => f.endsWith('/utils.ts') && (inDir(f, 'views') || inDir(f, 'components')))

/** Which imports in `path` match any forbidden prefix. */
function offendingImports(path: string, forbidden: readonly string[]): string[] {
  return importsOf(path).filter((spec) =>
    forbidden.some((bad) => spec === bad || spec.startsWith(bad)),
  )
}

/** Reported as `{ file: [bad, imports] }` so a failure names the file and the cause at once. */
function violations(
  paths: readonly string[],
  forbidden: readonly string[],
): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const path of paths) {
    const bad = offendingImports(path, forbidden)
    if (bad.length) out[path] = bad
  }
  return out
}

describe('domain is self-contained', () => {
  it('imports nothing but its own siblings', () => {
    const escaping: Record<string, string[]> = {}
    for (const path of sourcesIn('domain')) {
      const bad = importsOf(path).filter((s) => !s.startsWith('./') && !s.startsWith('@/domain/'))
      if (bad.length) escaping[path] = bad
    }
    expect(escaping).toEqual({})
  })
})

describe('services are pure', () => {
  const FORBIDDEN = [
    'vue',
    'pinia',
    '@ionic',
    'ionicons',
    '@/stores',
    '@/views',
    '@/components',
    '@/data',
  ]

  it('import no framework, store, screen or storage module', () => {
    expect(violations(sourcesIn('services'), FORBIDDEN)).toEqual({})
  })

  it('are synchronous — a service builds records, it never writes them', () => {
    const asyncServices = sourcesIn('services').filter((f) => /\basync\b/.test(read(f)))
    expect(asyncServices).toEqual([])
  })

  it('never read the clock — `today` is always an argument', () => {
    const clockReaders = sourcesIn('services').filter((f) => /todayIso\s*\(/.test(read(f)))
    expect(clockReaders).toEqual([])
  })
})

describe('screen utils are pure', () => {
  const FORBIDDEN = ['vue', 'pinia', '@ionic', 'ionicons', '@/stores', '@/data']

  it('import no framework, store or storage module', () => {
    expect(violations(utilsFiles(), FORBIDDEN)).toEqual({})
  })

  it('never read the clock — `today` is always an argument', () => {
    expect(utilsFiles().filter((f) => /todayIso\s*\(/.test(read(f)))).toEqual([])
  })

  it('never reach into another screen\u2019s folder', () => {
    const trespassing: Record<string, string[]> = {}
    for (const path of utilsFiles()) {
      const ownFolder = path.slice(0, path.lastIndexOf('/'))
      const bad = importsOf(path).filter(
        (spec) =>
          (spec.startsWith('@/views/') || spec.startsWith('@/components/')) &&
          !spec.startsWith(`@/${ownFolder}/`),
      )
      if (bad.length) trespassing[path] = bad
    }
    expect(trespassing).toEqual({})
  })

  it('each has a colocated spec', () => {
    const unspecced = utilsFiles().filter((f) => !ALL.includes(f.replace(/\.ts$/, '.spec.ts')))
    expect(unspecced).toEqual([])
  })
})

describe('the store stays below the UI', () => {
  it('imports no view, component, router or Ionic module', () => {
    const forbidden = ['@/views', '@/components', 'vue-router', '@ionic']
    expect(violations(sourcesIn('stores'), forbidden)).toEqual({})
  })

  /**
   * The store's charter is the SELECT test: a projection, a `WHERE` on a stored field, an
   * `ORDER BY` or a key lookup. `@/domain/budgeting` is where every rollup lives, so importing it
   * is the clearest possible evidence the store has started calculating again.
   */
  it('imports no rollups — the SELECT test, enforced', () => {
    expect(violations(sourcesIn('stores'), ['@/domain/budgeting'])).toEqual({})
  })
})

describe('store access is confined', () => {
  /**
   * `useBudgetStore` in a plain module is how the store leaks back into the logic layers. The
   * allowlist is short on purpose: its own definition, the router guard that boots it, the test
   * harness, and the single sanctioned composable.
   */
  const ALLOWED = [
    'stores/budget.ts',
    'router/index.ts',
    'test/pinia.ts',
    'composables/useBudgetContext.ts',
  ]

  it('appears only in .vue files and the allowlist', () => {
    // Specs are exempt: naming the store in a test is not a production dependency on it.
    const leaks = ALL.filter(
      (f) =>
        f.endsWith('.ts') &&
        !isSpec(f) &&
        !ALLOWED.includes(f) &&
        /\buseBudgetStore\b/.test(read(f)),
    )
    expect(leaks).toEqual([])
  })
})

describe('composables stay bounded', () => {
  /**
   * One file, by policy: `useBudgetContext`, which exists only because eight views need `ctx`
   * and `period` and would otherwise each duplicate the wiring and the clock read. A second
   * file requires an ADR in `docs/` — this assertion is what makes that a visible decision
   * rather than a drive-by addition.
   */
  it('contains exactly one module', () => {
    const dir = join(SRC, 'composables')
    if (!existsSync(dir)) return
    const modules = ALL.filter((f) => inDir(f, 'composables') && f.endsWith('.ts') && !isSpec(f))
    expect(modules).toEqual(['composables/useBudgetContext.ts'])
  })
})
