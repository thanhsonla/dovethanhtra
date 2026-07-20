import { describe, expect, it } from 'vitest'

import {
  calculationInputMeta,
  geometryFromPositions,
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
})
