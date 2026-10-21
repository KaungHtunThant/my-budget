import { describe, expect, it } from 'vitest'

import { KEYBOARD_GAP, coveredHeight, revealDelta } from './keyboard'

describe('coveredHeight', () => {
  it('is the whole keyboard when the window kept its height', () => {
    expect(coveredHeight(320, 800, 800)).toBe(320)
  })

  it('is nothing when the window shrank by the keyboard’s height', () => {
    expect(coveredHeight(320, 800, 480)).toBe(0)
  })

  it('is the remainder when the window shrank only partly', () => {
    expect(coveredHeight(320, 800, 700)).toBe(220)
  })

  it('never goes negative, and never counts the window growing', () => {
    expect(coveredHeight(320, 800, 400)).toBe(0)
    expect(coveredHeight(320, 800, 900)).toBe(320)
  })
})

describe('revealDelta', () => {
  // An 800px viewport with 320px of keyboard over it: fields must end by 800 - 320 - gap.
  const limit = 800 - 320 - KEYBOARD_GAP

  it('leaves a field that already clears the keyboard where it is', () => {
    expect(revealDelta(limit, 800, 320)).toBe(0)
    expect(revealDelta(100, 800, 320)).toBe(0)
  })

  it('scrolls a covered field up until it clears the keyboard by the gap', () => {
    expect(revealDelta(700, 800, 320)).toBe(700 - limit)
    expect(revealDelta(limit + 0.2, 800, 320)).toBe(1)
  })

  it('does nothing while no keyboard is over the view, except honour the gap at the edge', () => {
    expect(revealDelta(500, 800, 0)).toBe(0)
    expect(revealDelta(790, 800, 0)).toBe(790 - (800 - KEYBOARD_GAP))
  })

  it('takes a custom gap', () => {
    expect(revealDelta(470, 800, 320, 0)).toBe(0)
    expect(revealDelta(490, 800, 320, 0)).toBe(10)
  })
})
