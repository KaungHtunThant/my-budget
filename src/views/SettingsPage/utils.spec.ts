import { describe, expect, it } from 'vitest'

import { confirmsClear, importSummary, needsWinnerChoice } from './utils'

const total = (added: number, identical: number, conflicts: number) => ({ added, identical, conflicts })

describe('importSummary', () => {
  it('names the app version and date first, then what importing would do', () => {
    expect(
      importSummary({
        appVersion: '2.0.0',
        converted: false,
        exportedAt: '2026-10-21T09:30:00.000Z',
        total: total(3, 40, 1),
      }),
    ).toBe(
      'Backup from My Budget 2.0.0, made 21 Oct 2026. It has 3 records new to this phone, ' +
        '40 records already here, 1 record that differs from this phone’s.',
    )
  })

  it('says when a file predates version stamps and will be converted', () => {
    expect(
      importSummary({ appVersion: null, converted: true, exportedAt: null, total: total(1, 0, 0) }),
    ).toBe(
      'Backup from an earlier My Budget (before 2.0.0). It will be converted to this version’s ' +
        'format. It has 1 record new to this phone.',
    )
  })

  it('reads sensibly for an empty file', () => {
    expect(
      importSummary({ appVersion: '2.0.0', converted: false, exportedAt: null, total: total(0, 0, 0) }),
    ).toBe('Backup from My Budget 2.0.0. It is empty.')
  })
})

describe('needsWinnerChoice', () => {
  it('asks only when some record differs', () => {
    expect(needsWinnerChoice(total(5, 2, 0))).toBe(false)
    expect(needsWinnerChoice(total(0, 0, 1))).toBe(true)
  })
})

describe('confirmsClear', () => {
  it('needs the word typed, in any case, and nothing else', () => {
    expect(confirmsClear('DELETE')).toBe(true)
    expect(confirmsClear(' delete ')).toBe(true)
    expect(confirmsClear('del')).toBe(false)
    expect(confirmsClear(undefined)).toBe(false)
  })
})
