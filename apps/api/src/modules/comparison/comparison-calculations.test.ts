import { describe, expect, it } from 'vitest'

import { compareQuantities } from './comparison-calculations.js'

describe('comparison calculations', () => {
  it('calculates CAL-006 and applies either threshold', () => {
    expect(compareQuantities(90, 100, { absolute: 20, percent: 5 })).toEqual({
      difference: -10,
      absoluteDifference: 10,
      differencePercent: -10,
      status: 'warning',
    })
  })

  it('does not divide by a zero source baseline', () => {
    expect(compareQuantities(5, 0, { absolute: 1 })).toEqual({
      difference: 5,
      absoluteDifference: 5,
      differencePercent: null,
      status: 'no_source_baseline',
    })
  })
})
