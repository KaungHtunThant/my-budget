import { describe, expect, it } from 'vitest'

import { APP_VERSION, compareVersions, isNewerMajor, parseVersion } from './version'

describe('APP_VERSION', () => {
  it('is the package version, injected at build time', async () => {
    const pkg = (await import('../../package.json')).default as { version: string }
    expect(APP_VERSION).toBe(pkg.version)
  })
})

describe('compareVersions', () => {
  it('orders by major, then minor, then patch — numerically, not as text', () => {
    expect(compareVersions('1.10.0', '1.9.0')).toBeGreaterThan(0)
    expect(compareVersions('2.0.0', '1.99.99')).toBeGreaterThan(0)
    expect(compareVersions('1.1.0', '1.1.1')).toBeLessThan(0)
    expect(compareVersions('2.0.0', '2.0.0')).toBe(0)
  })

  it('reads missing parts as zero', () => {
    expect(parseVersion('2')).toEqual([2, 0, 0])
    expect(compareVersions('2', '2.0.0')).toBe(0)
  })
})

describe('isNewerMajor', () => {
  it('is true only for a later major series', () => {
    expect(isNewerMajor('3.0.0', '2.4.1')).toBe(true)
    expect(isNewerMajor('2.9.0', '2.0.0')).toBe(false)
    expect(isNewerMajor('1.1.0', '2.0.0')).toBe(false)
  })
})
