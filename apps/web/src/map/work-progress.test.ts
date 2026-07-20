import type { Measurement, MeasurementListResponse, WorkItem, WorkType } from '@dove/contracts'
import { describe, expect, it } from 'vitest'

import { nextWorkToVisit, workProgress } from './work-progress.js'

const workItem = (id: string, name: string): WorkItem => ({
  caseId: '00000000-0000-4000-8000-000000000001',
  formulaSnapshot: {},
  id,
  name,
  periodEnd: null,
  periodStart: null,
  status: 'active',
  unit: 'm',
  warningThreshold: {},
  workTypeCode: 'LINE',
  workTypeId: '00000000-0000-4000-8000-000000000010',
})

const measurement = (status: Measurement['status']): Measurement => ({
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
  status,
  supersedesId: null,
  unit: 'm',
  updatedAt: '2026-07-20T00:00:00.000Z',
  validationStatus: 'valid',
  version: 1,
  warnings: [],
  workItemId: '00000000-0000-4000-8000-000000000003',
})

const summary = (items: Measurement[]): MeasurementListResponse => ({
  confirmedTotal: 10,
  items,
  nextCursor: null,
  unit: 'm',
})

describe('work progress', () => {
  it('reports data and review states without treating a work item as completed', () => {
    const items = workProgress(
      [
        workItem('00000000-0000-4000-8000-000000000011', 'Đang rà soát'),
        workItem('00000000-0000-4000-8000-000000000012', 'Chưa đo'),
      ],
      [{ id: '00000000-0000-4000-8000-000000000010', name: 'Đo tuyến' } as WorkType],
      {
        '00000000-0000-4000-8000-000000000011': summary([
          measurement('confirmed'),
          measurement('draft'),
        ]),
      },
    )

    expect(items).toMatchObject([
      { confirmed: 1, hasData: true, name: 'Đang rà soát', review: 1 },
      { confirmed: 0, hasData: false, name: 'Chưa đo', review: 0 },
    ])
    expect(nextWorkToVisit(items, '00000000-0000-4000-8000-000000000012')?.name).toBe(
      'Đang rà soát',
    )
  })
})
