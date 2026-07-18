import { describe, expect, it } from 'vitest'

import { routeQuantities, weightedDistance } from './route-calculations.js'

describe('route calculations', () => {
  it('passes CAL-004 vehicle.km', () => {
    expect(routeQuantities(10_000, 2, 5, undefined).vehicleKm).toBe(100)
  })

  it('passes CAL-005 weighted distance', () => {
    expect(
      weightedDistance([
        { distanceKm: 10, weightTon: 3 },
        { distanceKm: 20, weightTon: 7 },
      ]),
    ).toEqual({ weightedDistanceKm: 17, warnings: [] })
  })

  it('warns instead of dividing by zero', () => {
    expect(weightedDistance([{ distanceKm: 10, weightTon: 0 }])).toEqual({
      weightedDistanceKm: null,
      warnings: ['MISSING_TRANSPORT_WEIGHT'],
    })
  })
})
