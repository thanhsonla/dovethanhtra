import { describe, expect, it } from 'vitest'

import { AppError } from '../../platform/app-error.js'
import { validateGeoJsonInput } from './geometry-validation.js'

describe('GeoJSON measurement validation', () => {
  it('accepts a structurally valid self-intersecting ring for PostGIS validity analysis', () => {
    expect(() =>
      validateGeoJsonInput(
        {
          type: 'Polygon',
          coordinates: [
            [
              [104.68, 20.8],
              [104.681, 20.801],
              [104.681, 20.8],
              [104.68, 20.801],
              [104.68, 20.8],
            ],
          ],
        },
        'area',
      ),
    ).not.toThrow()
  })

  it.each([
    {
      coordinates: [
        [104.68, 20.8],
        [104.681, 20.801],
        [104.681, 20.8],
        [104.68, 20.801],
      ],
      type: 'Polygon' as const,
    },
    { coordinates: [[181, 20.8]], type: 'LineString' as const },
  ])('rejects malformed coordinates before calling PostGIS', (geometry) => {
    expect(() =>
      validateGeoJsonInput(geometry, geometry.type === 'Polygon' ? 'area' : 'line'),
    ).toThrowError(AppError)
  })
})
