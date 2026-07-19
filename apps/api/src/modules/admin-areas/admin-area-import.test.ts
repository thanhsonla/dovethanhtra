import { readFileSync } from 'node:fs'

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

  it('accepts the reviewed Sơn La 75-unit boundary package', () => {
    const content = readFileSync(
      new URL('../../../../../data/admin-areas/son-la-75-communes-2025.geojson', import.meta.url),
    )
    const parsed = parseAdminAreaGeoJson(content)

    expect(parsed.records).toHaveLength(75)
    expect(new Set(parsed.records.map((record) => record.code)).size).toBe(75)
    expect(parsed.records.filter((record) => record.areaType === 'commune')).toHaveLength(67)
    expect(parsed.records.filter((record) => record.areaType === 'ward')).toHaveLength(8)
    expect(parsed.records.every((record) => record.validFrom === '2025-07-01')).toBe(true)
    expect(parsed.records.every((record) => record.geometry.type === 'MultiPolygon')).toBe(true)
    expect(parsed.records.filter((record) => record.normalizationReason !== null)).toMatchObject([
      { code: '03760' },
    ])
    expect(parsed.sourceHash).toBe(
      '3bf730467596baa1e72f17f88679c008e93ff4fd54ca4e7072ca04fcaa243c39',
    )
  })

  it('accepts the topology-normalized Sơn La package with explicit supersession', () => {
    const content = readFileSync(
      new URL(
        '../../../../../data/admin-areas/son-la-75-communes-topology-2026.geojson',
        import.meta.url,
      ),
    )
    const parsed = parseAdminAreaGeoJson(content)

    expect(parsed.records).toHaveLength(75)
    expect(parsed.records.every((record) => record.validFrom === '2026-07-19')).toBe(true)
    expect(
      parsed.records.every(
        (record) => record.supersedesSourceVersion === 'son-la-75-qdt19-2025-gis-20260311-86361845',
      ),
    ).toBe(true)
    expect(parsed.sourceHash).toBe(
      'ad1d369974aee3a2a35d96a9cf7dc368f3f5463b2d2e3aee5535b77be4c6cdd8',
    )
  })
})
