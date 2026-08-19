import { describe, expect, it } from 'vitest'

import { WARNING_AT_PERCENT, fillColor, fillWidth, paceOffset } from './utils'

describe('fillWidth', () => {
  it('tracks the percentage', () => {
    expect(fillWidth(0)).toBe('0%')
    expect(fillWidth(60)).toBe('60%')
    expect(fillWidth(100)).toBe('100%')
  })

  it('stays full when over budget rather than overflowing the row', () => {
    // A row at 300% still has to line up with its neighbours; `over` communicates the excess.
    expect(fillWidth(300)).toBe('100%')
  })

  it('never goes negative', () => {
    expect(fillWidth(-20)).toBe('0%')
  })
})

describe('fillColor', () => {
  it('uses the caller’s colour well below the threshold', () => {
    expect(fillColor(40, false, 'primary')).toBe('var(--ion-color-primary)')
    expect(fillColor(40, false, 'tertiary')).toBe('var(--ion-color-tertiary)')
  })

  it('warns from the threshold upwards', () => {
    expect(fillColor(WARNING_AT_PERCENT, false, 'primary')).toBe('var(--ion-color-warning)')
    expect(fillColor(99, false, 'primary')).toBe('var(--ion-color-warning)')
  })

  it('stays on the caller’s colour just below the threshold', () => {
    expect(fillColor(WARNING_AT_PERCENT - 1, false, 'primary')).toBe('var(--ion-color-primary)')
  })

  it('goes red once over, whatever the percentage says', () => {
    expect(fillColor(50, true, 'primary')).toBe('var(--ion-color-danger)')
    expect(fillColor(300, true, 'success')).toBe('var(--ion-color-danger)')
  })
})

describe('paceOffset', () => {
  it('takes a 0–1 fraction, matching periodProgress', () => {
    expect(paceOffset(0)).toBe('0%')
    expect(paceOffset(0.5)).toBe('50%')
    expect(paceOffset(1)).toBe('100%')
  })

  it('clamps, so the marker cannot sit outside the track', () => {
    expect(paceOffset(1.4)).toBe('100%')
    expect(paceOffset(-0.2)).toBe('0%')
  })
})
