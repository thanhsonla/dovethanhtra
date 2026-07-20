import type { Measurement, MeasurementListResponse } from '@dove/contracts'
import { describe, expect, it } from 'vitest'

import { reviewableMeasurements } from './measurement-review-queue.js'

const measurement = (input: Partial<Measurement>): Measurement => ({
  baseValue: 10,
  calculatedQuantity: 10,
  calculationInputs: {},
  calculationOutput: {},
  calculationRuleCode: 'RULE-1',
  calculationVersion: 1,
  caseId: '00000000-0000-4000-8000-000000000001',
  code: 'MEAS-1',
  confirmedAt: null,
  createdAt: '2026-07-20T00:00:00.000Z',
  deletedAt: null,
  geometryKind: 'line',
  gpsAccuracyM: null,
  id: '00000000-0000-4000-8000-000000000002',
  method: 'map_draw',
  name: 'Đoạn thử',
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
  updatedAt: '2026-07-20T00:00:00.000Z',
  validationStatus: 'valid',
  version: 1,
  warnings: [],
  workItemId: '00000000-0000-4000-8000-000000000003',
  ...input,
})

describe('measurement review queue', () => {
  it('keeps only current measurements that need a user review', () => {
    const summary: MeasurementListResponse = {
      confirmedTotal: 10,
      items: [
        measurement({ status: 'confirmed' }),
        measurement({ id: '00000000-0000-4000-8000-000000000004', status: 'draft' }),
        measurement({ id: '00000000-0000-4000-8000-000000000005', status: 'needs_attention' }),
        measurement({ id: '00000000-0000-4000-8000-000000000006', status: 'superseded' }),
      ],
      nextCursor: null,
      unit: 'm',
    }

    expect(reviewableMeasurements(summary).map((item) => item.status)).toEqual([
      'draft',
      'needs_attention',
    ])
  })
})
