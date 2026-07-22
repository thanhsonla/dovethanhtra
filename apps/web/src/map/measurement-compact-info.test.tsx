import type { Measurement } from '@dove/contracts'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { MeasurementCompactInfo } from './measurement-compact-info.js'

const measurement: Measurement = {
  baseValue: 1404.53,
  calculatedQuantity: 1404.53,
  calculationInputs: {},
  calculationOutput: {},
  calculationRuleCode: 'RULE-LENGTH-1',
  calculationVersion: 1,
  caseId: '00000000-0000-4000-8000-000000000001',
  captureDraftId: null,
  code: 'MEAS-1',
  confirmedAt: null,
  createdAt: '2026-07-22T07:05:00.000Z',
  deletedAt: null,
  geometryKind: 'line',
  gpsAccuracyM: null,
  id: '00000000-0000-4000-8000-000000000002',
  method: 'map_draw',
  name: 'Đường thảo nguyên',
  normalizedGeometry: null,
  note: null,
  rawGeometry: {
    coordinates: [
      [104.65, 20.8],
      [104.651, 20.8],
    ],
    type: 'LineString',
  },
  status: 'draft',
  supersedesId: null,
  unit: 'm',
  updatedAt: '2026-07-22T07:05:00.000Z',
  validationStatus: 'valid',
  version: 1,
  warnings: [],
  workComponentId: null,
  workItemId: '00000000-0000-4000-8000-000000000003',
}

describe('MeasurementCompactInfo', () => {
  it('shows only the requested compact measurement fields', () => {
    const html = renderToString(<MeasurementCompactInfo measurement={measurement} />)

    expect(html).toContain('Tên')
    expect(html).toContain('Đường thảo nguyên')
    expect(html).toContain('Thời gian lập')
    expect(html).toContain('Số liệu')
    expect(html).toContain('1.404,53<!-- -->m')
    expect(html).not.toContain('GeoJSON')
    expect(html).not.toContain('GPS')
  })
})
