import { describe, expect, it } from 'vitest'

import { AppError } from '../../platform/app-error.js'
import { parseMeasurementImport } from './measurement-import.js'

describe('measurement GeoJSON import parser', () => {
  it('detects scalar schema and selected names deterministically', () => {
    const parsed = parseMeasurementImport({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { name: 'Tuyến 1', active: true, level: 2 },
          geometry: {
            type: 'LineString',
            coordinates: [
              [104.6, 20.8],
              [104.61, 20.8],
            ],
          },
        },
      ],
    })
    expect(parsed.geometryKind).toBe('line')
    expect(parsed.features[0]!.name).toBe('Tuyến 1')
    expect(parsed.detectedSchema).toEqual([
      { name: 'active', types: ['boolean'] },
      { name: 'level', types: ['number'] },
      { name: 'name', types: ['string'] },
    ])
    expect(parsed.sourceHash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('rejects mixed geometry batches and nested properties', () => {
    expect(() =>
      parseMeasurementImport({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: { type: 'Point', coordinates: [104.6, 20.8] },
          },
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: [
                [104.6, 20.8],
                [104.61, 20.8],
              ],
            },
          },
        ],
      }),
    ).toThrowError(AppError)
    expect(() =>
      parseMeasurementImport({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { unsafe: { nested: true } },
            geometry: { type: 'Point', coordinates: [104.6, 20.8] },
          },
        ],
      }),
    ).toThrowError(/scalar/)
  })
})
