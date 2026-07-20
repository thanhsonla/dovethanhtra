import type { Measurement, MeasurementListResponse } from '@dove/contracts'
import { describe, expect, it } from 'vitest'

import {
  confirmedSummary,
  measurementBaseValue,
  measurementPartLabel,
  measurementQuantity,
} from './measurement-summary.js'

const measurement = (input: Partial<Measurement>): Measurement => {
  const defaults: Measurement = {
    baseValue: 120.5,
    calculatedQuantity: 241,
    calculationInputs: {},
    calculationOutput: {},
    calculationRuleCode: 'RULE-LENGTH-1',
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
    name: 'Đoạn A',
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
    updatedAt: '2026-07-20T00:00:00.000Z',
    validationStatus: 'valid',
    version: 1,
    warnings: [],
    workItemId: '00000000-0000-4000-8000-000000000003',
  }
  return { ...defaults, ...input }
}

describe('measurement summaries', () => {
  it('formats each part with base and calculated values', () => {
    const item = measurement({})

    expect(measurementPartLabel(item, 1)).toBe('Đoạn 2')
    expect(measurementBaseValue(item)).toBe('120,50 m')
    expect(measurementQuantity(item)).toBe('241,00 m')
  })

  it('shows confirmed aggregate count and total only from the API summary', () => {
    const summary: MeasurementListResponse = {
      confirmedTotal: 241,
      items: [measurement({ status: 'confirmed' }), measurement({ status: 'draft' })],
      nextCursor: null,
      unit: 'm',
    }

    expect(confirmedSummary(summary)).toEqual({ count: 1, total: '241,00 m' })
  })
})
