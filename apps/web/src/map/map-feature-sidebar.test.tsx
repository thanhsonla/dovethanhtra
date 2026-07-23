import type { Measurement } from '@dove/contracts'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { MapFeatureSidebar } from './map-feature-sidebar.js'

function measurement(input: Partial<Measurement> = {}): Measurement {
  return {
    baseValue: 120.5,
    calculatedQuantity: 120.5,
    calculationInputs: {},
    calculationOutput: {},
    calculationRuleCode: 'RULE-LENGTH-1',
    calculationVersion: 1,
    caseId: '00000000-0000-4000-8000-000000000001',
    captureDraftId: null,
    code: 'MEAS-1',
    confirmedAt: '2026-07-22T00:00:00.000Z',
    createdAt: '2026-07-22T00:00:00.000Z',
    deletedAt: null,
    geometryKind: 'line',
    gpsAccuracyM: null,
    id: '00000000-0000-4000-8000-000000000002',
    method: 'map_draw',
    name: 'Đường Tô Hiệu',
    normalizedGeometry: null,
    note: null,
    rawGeometry: {
      coordinates: [
        [104.65, 20.8],
        [104.651, 20.8],
      ],
      type: 'LineString',
    },
    status: 'confirmed',
    supersedesId: null,
    unit: 'm',
    updatedAt: '2026-07-22T00:00:00.000Z',
    validationStatus: 'valid',
    version: 1,
    warnings: [],
    workComponentId: null,
    workItemId: '00000000-0000-4000-8000-000000000003',
    ...input,
  }
}

describe('map feature sidebar', () => {
  it('groups component measurements under their primary object', () => {
    const primary = measurement()
    const component = measurement({
      baseValue: 29.5,
      createdAt: '2026-07-22T01:00:00.000Z',
      id: '00000000-0000-4000-8000-000000000004',
      name: 'Tuyến 02',
    })
    const anotherObject = measurement({
      id: '00000000-0000-4000-8000-000000000005',
      name: 'Đường Cách mạng tháng Tám',
      workItemId: '00000000-0000-4000-8000-000000000006',
    })

    const html = renderToString(
      <MapFeatureSidebar
        measurements={[primary, component, anotherObject]}
        selectedId={null}
        onSelect={() => undefined}
      />,
    )

    expect(html).toContain('Đường Tô Hiệu')
    expect(html).toContain('150,00 m')
    expect(html).toContain('phần đo bổ sung')
    expect(html).toContain('Tuyến 02')
    expect(html.match(/map-feature-sidebar__item "/g)).toHaveLength(2)
  })
})
