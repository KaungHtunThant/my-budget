import { describe, expect, it } from 'vitest'

import { EXIT_WINDOW_MS, backAction } from './back'

const NOW = 1_000_000

describe('backAction', () => {
  it('goes to the parent whenever the page has one, even straight after a warning', () => {
    expect(backAction('/tabs/more', null, NOW)).toEqual({ kind: 'parent', to: '/tabs/more' })
    expect(backAction('/settings', NOW - 10, NOW)).toEqual({ kind: 'parent', to: '/settings' })
  })

  it('warns on the first press on a top-level page', () => {
    expect(backAction(undefined, null, NOW)).toEqual({ kind: 'warn' })
  })

  it('exits on a second press inside the window', () => {
    expect(backAction(undefined, NOW - 1, NOW)).toEqual({ kind: 'exit' })
    expect(backAction(undefined, NOW - (EXIT_WINDOW_MS - 1), NOW)).toEqual({ kind: 'exit' })
  })

  it('warns again once the window has passed, edge included', () => {
    expect(backAction(undefined, NOW - EXIT_WINDOW_MS, NOW)).toEqual({ kind: 'warn' })
    expect(backAction(undefined, NOW - 10 * EXIT_WINDOW_MS, NOW)).toEqual({ kind: 'warn' })
  })

  it('honours a custom window', () => {
    expect(backAction(undefined, NOW - 500, NOW, 400)).toEqual({ kind: 'warn' })
    expect(backAction(undefined, NOW - 300, NOW, 400)).toEqual({ kind: 'exit' })
  })
})
