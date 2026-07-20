import { describe, expect, it } from 'vitest'

import { geometryExtent } from './map-selection.js'

describe('geometryExtent', () => {
  it('calculates the extent for nested polygon coordinates', () => {
    expect(
      geometryExtent({
        type: 'Polygon',
        coordinates: [
          [
            [104.1, 20.3],
            [104.8, 20.2],
            [104.6, 20.9],
            [104.1, 20.3],
          ],
        ],
      }),
    ).toEqual({ east: 104.8, north: 20.9, south: 20.2, west: 104.1 })
  })

  it('returns a point-sized extent for a point', () => {
    expect(geometryExtent({ type: 'Point', coordinates: [104.5, 20.5] })).toEqual({
      east: 104.5,
      north: 20.5,
      south: 20.5,
      west: 104.5,
    })
  })
})
