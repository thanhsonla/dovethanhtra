import { describe, expect, it } from 'vitest'

import { parseAdminAreaGeoJson } from './admin-area-import.js'

function file(overrides: Record<string, unknown> = {}) {
  return Buffer.from(
    JSON.stringify({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            areaType: 'district',
            code: 'TEST_AREA',
            name: 'Địa bàn kiểm thử',
            source: 'Nguồn kiểm thử',
            sourceVersion: '2026-01',
            validFrom: '2026-01-01',
            validTo: null,
          },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [104.6, 20.7],
                [104.7, 20.7],
                [104.7, 20.8],
                [104.6, 20.8],
                [104.6, 20.7],
              ],
            ],
          },
          ...overrides,
        },
      ],
    }),
  )
}

describe('admin area GeoJSON import', () => {
  it('parses an EPSG:4326 FeatureCollection and hashes the exact source bytes', () => {
    const parsed = parseAdminAreaGeoJson(file())
    expect(parsed.records[0]).toMatchObject({
      code: 'TEST_AREA',
      geometry: { type: 'Polygon' },
      sourceVersion: '2026-01',
    })
    expect(parsed.sourceHash).toMatch(/^[0-9a-f]{64}$/)
  })

  it.each([
    {
      geometry: {
        coordinates: [
          [
            [181, 20],
            [104, 20],
            [104, 21],
            [181, 20],
          ],
        ],
        type: 'Polygon',
      },
    },
    {
      geometry: {
        coordinates: [
          [
            [104, 20],
            [105, 20],
            [105, 21],
            [104, 21],
          ],
        ],
        type: 'Polygon',
      },
    },
    { geometry: { coordinates: [104, 20], type: 'Point' } },
  ])('rejects malformed, unclosed or unsupported geometry', (overrides) => {
    expect(() => parseAdminAreaGeoJson(file(overrides))).toThrow()
  })

  it('rejects an explicit CRS instead of guessing coordinate conversion', () => {
    const value = JSON.parse(file().toString('utf8')) as Record<string, unknown>
    value.crs = { properties: { name: 'EPSG:3405' }, type: 'name' }
    expect(() => parseAdminAreaGeoJson(Buffer.from(JSON.stringify(value)))).toThrow(/EPSG:4326/)
  })
})
