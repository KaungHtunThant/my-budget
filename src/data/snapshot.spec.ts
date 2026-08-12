/**
 * Snapshot behaviour: the durability backstop.
 *
 * The point of the file is the case where the object stores come up empty but the user's data
 * should not be gone — cleared webview storage, or a reinstall over kept app data. The last
 * test here is that scenario end to end.
 *
 * `@capacitor/filesystem` is faked with an in-memory directory. The real plugin is covered on
 * device; what needs pinning down in a unit test is the temp-then-rename discipline and the
 * restore path, both of which are ours rather than the plugin's.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

/** Stands in for Directory.Data: path -> contents. */
const disk = new Map<string, string>()

vi.mock('@capacitor/filesystem', () => ({
  Directory: { Data: 'DATA' },
  Encoding: { UTF8: 'utf8' },
  Filesystem: {
    writeFile: vi.fn(async ({ path, data }: { path: string; data: string }) => {
      disk.set(path, data)
      return { uri: `mem://${path}` }
    }),
    readFile: vi.fn(async ({ path }: { path: string }) => {
      if (!disk.has(path)) throw new Error(`File does not exist: ${path}`)
      return { data: disk.get(path) as string }
    }),
    deleteFile: vi.fn(async ({ path }: { path: string }) => {
      if (!disk.has(path)) throw new Error(`File does not exist: ${path}`)
      disk.delete(path)
    }),
    rename: vi.fn(async ({ from, to }: { from: string; to: string }) => {
      if (!disk.has(from)) throw new Error(`File does not exist: ${from}`)
      disk.set(to, disk.get(from) as string)
      disk.delete(from)
    }),
  },
}))

const { Filesystem } = await import('@capacitor/filesystem')
const { buildSnapshot, readSnapshot, writeSnapshot, debounceSnapshot } = await import('./snapshot')
const { SCHEMA_VERSION } = await import('./db')
const { buildSeed } = await import('./fixtures')
const { IndexedDbRepository } = await import('./indexeddb')

const FILE = 'my-budget-snapshot.json'
const BACKUP = 'my-budget-snapshot.bak.json'
const TEMP = 'my-budget-snapshot.tmp.json'

let dbCounter = 0

describe('snapshot file', () => {
  beforeEach(() => {
    disk.clear()
    vi.clearAllMocks()
  })

  it('stamps the schema version and export time', () => {
    const snap = buildSnapshot(buildSeed({}), '2026-08-12T00:00:00.000Z')
    expect(snap.schemaVersion).toBe(SCHEMA_VERSION)
    expect(snap.exportedAt).toBe('2026-08-12T00:00:00.000Z')
    expect(snap.settings.baseCurrency).toBe('USD')
  })

  it('round-trips through the file', async () => {
    const snap = buildSnapshot(buildSeed({ withDemoData: true }), '2026-08-12T00:00:00.000Z')
    expect(await writeSnapshot(snap)).toBe(true)

    const read = await readSnapshot()
    expect(read?.transactions.length).toBe(snap.transactions.length)
    expect(read?.wallets.map((w) => w.name)).toEqual(snap.wallets.map((w) => w.name))
  })

  it('writes via a temp file and leaves no temp behind', async () => {
    await writeSnapshot(buildSnapshot(buildSeed({}), 'now'))
    expect(disk.has(FILE)).toBe(true)
    expect(disk.has(TEMP)).toBe(false)
  })

  it('keeps the previous snapshot as a backup', async () => {
    await writeSnapshot(buildSnapshot(buildSeed({}), 'first'))
    await writeSnapshot(buildSnapshot(buildSeed({}), 'second'))

    expect(JSON.parse(disk.get(FILE) as string).exportedAt).toBe('second')
    expect(JSON.parse(disk.get(BACKUP) as string).exportedAt).toBe('first')
  })

  it('falls back to the backup when the primary is corrupt', async () => {
    await writeSnapshot(buildSnapshot(buildSeed({}), 'good'))
    await writeSnapshot(buildSnapshot(buildSeed({}), 'newer'))
    disk.set(FILE, '{ this is not json')

    expect((await readSnapshot())?.exportedAt).toBe('good')
  })

  it('refuses a snapshot from a newer schema rather than guessing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const future = { ...buildSnapshot(buildSeed({}), 'now'), schemaVersion: SCHEMA_VERSION + 1 }
      disk.set(FILE, JSON.stringify(future))

      expect(await readSnapshot()).toBeNull()
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('schema v2'))
    } finally {
      warn.mockRestore()
    }
  })

  it('returns null when nothing has been written', async () => {
    expect(await readSnapshot()).toBeNull()
  })

  it('reports failure instead of throwing when the write fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      vi.mocked(Filesystem.writeFile).mockRejectedValueOnce(new Error('disk full'))
      // A failed snapshot must not surface as a failed user action.
      expect(await writeSnapshot(buildSnapshot(buildSeed({}), 'now'))).toBe(false)
      expect(warn).toHaveBeenCalled()
    } finally {
      warn.mockRestore()
    }
  })
})

describe('debounceSnapshot', () => {
  it('coalesces a burst into one run, and can be cancelled or flushed', () => {
    vi.useFakeTimers()
    try {
      let runs = 0
      const d = debounceSnapshot(() => { runs += 1 }, 5000)

      d.schedule()
      d.schedule()
      d.schedule()
      expect(runs).toBe(0)
      vi.advanceTimersByTime(5000)
      expect(runs).toBe(1)

      d.schedule()
      d.cancel()
      vi.advanceTimersByTime(10_000)
      expect(runs).toBe(1)

      d.schedule()
      d.flush()
      expect(runs).toBe(2)
      // Flushing consumes the pending run rather than leaving it queued.
      vi.advanceTimersByTime(10_000)
      expect(runs).toBe(2)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('rebuilding from a snapshot', () => {
  beforeEach(() => {
    disk.clear()
  })

  it('restores the user data when the object stores come up empty', async () => {
    const name = `snapshot-${dbCounter++}`

    // A user with real data, and a snapshot on disk.
    const first = new IndexedDbRepository({ name })
    await first.init()
    const w = await first.createWallet({
      name: 'Payroll',
      kind: 'bank',
      currency: 'USD',
      openingBalance: { minor: 25_000, currency: 'USD' },
      icon: 'business-outline',
      color: 'primary',
      archived: false,
    })
    await first.createTransaction({
      type: 'income',
      amount: { minor: 306_600, currency: 'USD' },
      fx: null,
      walletId: w.id,
      toWalletId: null,
      toAmount: null,
      categoryId: null,
      date: '2026-07-25',
      note: 'Acme Corp',
      recurringRuleId: null,
      goalId: null,
    })
    expect(await first.saveSnapshot()).toBe(true)
    await first.destroy() // stands in for storage being cleared

    // Same database name, nothing in it. init() must rebuild rather than start over.
    const second = new IndexedDbRepository({ name })
    await second.init()
    try {
      expect((await second.listWallets()).map((x) => x.name)).toEqual(['Payroll'])
      expect((await second.listTransactions()).map((t) => t.note)).toEqual(['Acme Corp'])
      expect(await second.walletBalance((await second.listWallets())[0].id)).toEqual({
        minor: 331_600,
        currency: 'USD',
      })
    } finally {
      await second.destroy()
    }
  })

  it('seeds a fresh install when no snapshot exists', async () => {
    const repo = new IndexedDbRepository({ name: `snapshot-${dbCounter++}` })
    await repo.init()
    try {
      expect(await repo.listWallets()).toEqual([])
      expect((await repo.listCategories()).length).toBeGreaterThan(0)
    } finally {
      await repo.destroy()
    }
  })
})
