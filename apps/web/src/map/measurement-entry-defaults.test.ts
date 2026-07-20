import type { Measurement, WorkItem } from '@dove/contracts'
import { describe, expect, it } from 'vitest'

import { inheritedCalculationInputs, nextMeasurementName } from './measurement-entry-defaults.js'

const workItem = (requiredInputs: string[]): WorkItem => ({
  caseId: '00000000-0000-4000-8000-000000000001',
  formulaSnapshot: { calculationSpec: { requiredInputs } },
  id: '00000000-0000-4000-8000-000000000002',
  deletedAt: null,
  managementZoneId: null,
  managementZoneName: null,
  measurementKind: 'line',
  name: 'Công tác thử',
  periodEnd: null,
  periodStart: null,
  status: 'active',
  serviceGroupId: '00000000-0000-4000-8000-000000000007',
  serviceGroupName: 'Nhóm thử',
  unit: 'm.lần',
  warningThreshold: {},
  workTypeCode: 'TEST_LINE',
  workTypeId: '00000000-0000-4000-8000-000000000003',
  version: 1,
})

const measurement = (input: Partial<Measurement>): Measurement => ({
  baseValue: 100,
  calculatedQuantity: 200,
  calculationInputs: {},
  calculationOutput: {},
  calculationRuleCode: 'RULE-1',
  calculationVersion: 1,
  caseId: '00000000-0000-4000-8000-000000000001',
  code: 'MEAS-1',
  confirmedAt: null,
  createdAt: '2026-07-20T01:00:00.000Z',
  deletedAt: null,
  geometryKind: 'line',
  gpsAccuracyM: null,
  id: '00000000-0000-4000-8000-000000000004',
  method: 'map_draw',
  name: 'Đoạn cũ',
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
  unit: 'm.lần',
  updatedAt: '2026-07-20T01:00:00.000Z',
  validationStatus: 'valid',
  version: 1,
  warnings: [],
  workItemId: '00000000-0000-4000-8000-000000000002',
  ...input,
  captureDraftId: input.captureDraftId ?? null,
  workComponentId: input.workComponentId ?? null,
})

describe('measurement entry defaults', () => {
  it('creates a human-readable next part name without counting superseded versions', () => {
    const measurements = [
      measurement({}),
      measurement({ id: '00000000-0000-4000-8000-000000000005', status: 'superseded' }),
    ]

    expect(nextMeasurementName('line', measurements)).toBe('Đoạn 02')
    expect(nextMeasurementName('area', measurements)).toBe('Vùng 01')
  })

  it('inherits only required, valid values from the most recently updated measurements', () => {
    const measurements = [
      measurement({ calculationInputs: { frequency: 1, service_days: 30 } }),
      measurement({
        calculationInputs: { frequency: 2, service_days: -1 },
        id: '00000000-0000-4000-8000-000000000006',
        updatedAt: '2026-07-20T02:00:00.000Z',
      }),
    ]

    expect(
      inheritedCalculationInputs(
        workItem(['frequency', 'service_days', 'side_factor']),
        measurements,
      ),
    ).toEqual({ frequency: 2, service_days: 30 })
  })
})
