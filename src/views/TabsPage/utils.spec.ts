import { describe, expect, it } from 'vitest'

import {
  COMMIT_FRACTION,
  EDGE_RESISTANCE,
  FLICK_DISTANCE,
  FLICK_VELOCITY,
  TAB_ORDER,
  activeTabFor,
  indicatorPercent,
  neighbourTab,
  shouldCommit,
  swipeState,
  tabPath,
} from './utils'

const WIDTH = 400

describe('TAB_ORDER', () => {
  it('is the dock order, and every entry has a route path', () => {
    expect([...TAB_ORDER]).toEqual(['home', 'transactions', 'budgets', 'goals', 'more'])
    expect(TAB_ORDER.map(tabPath)).toEqual([
      '/tabs/home',
      '/tabs/transactions',
      '/tabs/budgets',
      '/tabs/goals',
      '/tabs/more',
    ])
  })
})

describe('activeTabFor', () => {
  it('reads the tab out of a tab path', () => {
    expect(activeTabFor('/tabs/home')).toBe('home')
    expect(activeTabFor('/tabs/more')).toBe('more')
  })

  it('is null for a path that is not a tab', () => {
    expect(activeTabFor('/settings')).toBeNull()
    expect(activeTabFor('/onboarding')).toBeNull()
    expect(activeTabFor('/')).toBeNull()
  })

  it('is null for the bare tabs path rather than guessing at Home', () => {
    // The router redirects the empty child to /tabs/home, so there is no state to guess about —
    // and guessing would sit the indicator under Home while another view was on screen.
    expect(activeTabFor('/tabs/')).toBeNull()
    expect(activeTabFor('/tabs')).toBeNull()
  })

  it('is null for an unknown tab, which the router redirects away anyway', () => {
    expect(activeTabFor('/tabs/payslips')).toBeNull()
  })
})

describe('neighbourTab', () => {
  it('steps either way through the order', () => {
    expect(neighbourTab('budgets', 1)).toBe('goals')
    expect(neighbourTab('budgets', -1)).toBe('transactions')
  })

  it('stops at both ends rather than wrapping', () => {
    expect(neighbourTab('home', -1)).toBeNull()
    expect(neighbourTab('more', 1)).toBeNull()
  })
})

describe('swipeState', () => {
  it('takes a leftward drag to the next tab, as every paged interface does', () => {
    expect(swipeState('home', -100, WIDTH)).toMatchObject({ from: 'home', to: 'transactions', step: 1 })
  })

  it('takes a rightward drag to the previous tab', () => {
    expect(swipeState('budgets', 100, WIDTH)).toMatchObject({ to: 'transactions', step: -1 })
  })

  it('reports progress as the fraction of the viewport covered', () => {
    expect(swipeState('home', -100, WIDTH).progress).toBeCloseTo(0.25, 5)
  })

  it('caps progress at 1 so a long drag cannot overshoot', () => {
    expect(swipeState('home', -900, WIDTH).progress).toBe(1)
  })

  it('damps the progress at an edge, where there is nothing to move to', () => {
    const state = swipeState('home', 100, WIDTH)
    expect(state.to).toBeNull()
    expect(state.progress).toBeCloseTo(0.25 * EDGE_RESISTANCE, 5)
  })

  it('survives a zero width rather than returning NaN', () => {
    // Belt and braces: a gesture cannot really fire before layout, but NaN here would reach a
    // style binding and silently blank the indicator.
    expect(swipeState('home', -100, 0).progress).toBe(0)
  })
})

describe('shouldCommit', () => {
  it('commits a drag past the distance threshold', () => {
    expect(shouldCommit(-(WIDTH * COMMIT_FRACTION + 1), 0, WIDTH)).toBe(true)
    expect(shouldCommit(-(WIDTH * COMMIT_FRACTION - 1), 0, WIDTH)).toBe(false)
  })

  it('commits a flick that never travelled far', () => {
    expect(shouldCommit(-(FLICK_DISTANCE + 1), -(FLICK_VELOCITY + 0.1), WIDTH)).toBe(true)
  })

  it('refuses a flick that has barely moved, which is a tap with a stray velocity', () => {
    expect(shouldCommit(-(FLICK_DISTANCE - 1), -1, WIDTH)).toBe(false)
  })

  it('refuses a slow short drag', () => {
    expect(shouldCommit(-40, -0.05, WIDTH)).toBe(false)
  })

  it('refuses a drag reversed at the last moment, however far it had gone', () => {
    // Finger went a long way left, then headed back right before lifting: the user changed their
    // mind, and honouring the distance would change tab against their intent.
    expect(shouldCommit(-300, 0.5, WIDTH)).toBe(false)
  })

  it('ignores a zero delta', () => {
    expect(shouldCommit(0, 2, WIDTH)).toBe(false)
  })
})

describe('indicatorPercent', () => {
  const SLOT = 100 / TAB_ORDER.length

  it('sits on the active tab when nothing is being dragged', () => {
    expect(indicatorPercent(null, 'home')).toBe(0)
    expect(indicatorPercent(null, 'budgets')).toBeCloseTo(2 * SLOT, 5)
    expect(indicatorPercent(null, 'more')).toBeCloseTo(4 * SLOT, 5)
  })

  it('travels between the two slots as the drag progresses', () => {
    const half = swipeState('home', -WIDTH / 2, WIDTH)
    expect(indicatorPercent(half, 'home')).toBeCloseTo(0.5 * SLOT, 5)
  })

  it('lands exactly on the target slot at full progress', () => {
    const done = swipeState('transactions', -WIDTH, WIDTH)
    expect(indicatorPercent(done, 'transactions')).toBeCloseTo(2 * SLOT, 5)
  })

  it('travels backwards on a rightward drag', () => {
    const back = swipeState('budgets', WIDTH / 2, WIDTH)
    expect(indicatorPercent(back, 'budgets')).toBeCloseTo(1.5 * SLOT, 5)
  })

  it('nudges past the end at an edge, which is what reads as resistance', () => {
    const edge = swipeState('more', -WIDTH, WIDTH)
    expect(edge.to).toBeNull()
    expect(indicatorPercent(edge, 'more')).toBeCloseTo((4 + EDGE_RESISTANCE) * SLOT, 5)
  })
})
