import { describe, expect, it } from 'vitest'

import {
  addPolygonHole,
  calculationInputMeta,
  geometryFromPositions,
  polygonHoleAreasMeters,
  polygonHoleGeometries,
  polygonOuterAreaMeters,
  positionsFromGeometry,
  temporaryValue,
} from './map-geometry.js'

describe('draft map geometry', () => {
  it('builds point, line and a closed polygon ring', () => {
    expect(geometryFromPositions('point', [[104.65, 20.8]])).toEqual({
      coordinates: [104.65, 20.8],
      type: 'Point',
    })
    expect(
      geometryFromPositions('line', [
        [104.65, 20.8],
        [104.66, 20.8],
      ]),
    ).toMatchObject({ type: 'LineString' })
    expect(
      geometryFromPositions('area', [
        [104.65, 20.8],
        [104.66, 20.8],
        [104.66, 20.81],
      ]),
    ).toEqual({
      coordinates: [
        [
          [104.65, 20.8],
          [104.66, 20.8],
          [104.66, 20.81],
          [104.65, 20.8],
        ],
      ],
      type: 'Polygon',
    })
  })

  it('shows a temporary client value while the server remains authoritative', () => {
    const line = geometryFromPositions('line', [
      [104.65, 20.8],
      [104.65961, 20.8],
    ])
    expect(temporaryValue(line)).toMatch(/^\d+\.\d{2} m$/)

    const polygon = geometryFromPositions('area', [
      [104.65, 20.8],
      [104.651, 20.8],
      [104.651, 20.801],
    ])
    expect(temporaryValue(polygon)).toMatch(/^\d+\.\d{2} m²$/)
  })

  it('extracts draft vertices before and after a drawable geometry is complete', () => {
    expect(positionsFromGeometry(null)).toEqual([])
    expect(positionsFromGeometry({ type: 'Point', coordinates: [104.65, 20.8] })).toEqual([
      [104.65, 20.8],
    ])
    expect(
      positionsFromGeometry({
        coordinates: [
          [
            [104.65, 20.8],
            [104.66, 20.8],
            [104.65, 20.8],
          ],
        ],
        type: 'Polygon',
      }),
    ).toEqual([
      [104.65, 20.8],
      [104.66, 20.8],
    ])
  })

  it('explains common calculation inputs in user-facing Vietnamese', () => {
    expect(calculationInputMeta('side_factor')).toMatchObject({
      label: 'Hệ số mặt/tuyến',
    })
    expect(calculationInputMeta('frequency')).toMatchObject({
      label: 'Tần suất thực hiện',
    })
  })

  it('adds an interior subtraction ring and exposes its area separately', () => {
    const outer = geometryFromPositions('area', [
      [104.65, 20.8],
      [104.66, 20.8],
      [104.66, 20.81],
      [104.65, 20.81],
    ])!
    const subtraction = geometryFromPositions('area', [
      [104.653, 20.803],
      [104.657, 20.803],
      [104.657, 20.807],
      [104.653, 20.807],
    ])!
    const result = addPolygonHole(outer, subtraction)

    expect(result.type).toBe('Polygon')
    expect((result.coordinates as unknown[][]).length).toBe(2)
    expect(polygonHoleGeometries(result)).toHaveLength(1)
    expect(polygonHoleAreasMeters(result)[0]).toBeGreaterThan(0)
    expect(polygonOuterAreaMeters(result)).toBeGreaterThan(polygonHoleAreasMeters(result)[0]!)
  })

  it('rejects a subtraction outside the selected polygon or overlapping an existing hole', () => {
    const outer = geometryFromPositions('area', [
      [104.65, 20.8],
      [104.66, 20.8],
      [104.66, 20.81],
      [104.65, 20.81],
    ])!
    const outside = geometryFromPositions('area', [
      [104.659, 20.809],
      [104.661, 20.809],
      [104.661, 20.811],
    ])!
    expect(() => addPolygonHole(outer, outside)).toThrow(/nằm hoàn toàn bên trong/u)

    const firstHole = geometryFromPositions('area', [
      [104.653, 20.803],
      [104.657, 20.803],
      [104.657, 20.807],
      [104.653, 20.807],
    ])!
    const withHole = addPolygonHole(outer, firstHole)
    const overlap = geometryFromPositions('area', [
      [104.656, 20.806],
      [104.658, 20.806],
      [104.658, 20.808],
    ])!
    expect(() => addPolygonHole(withHole, overlap)).toThrow(/không được giao/u)
  })
})
