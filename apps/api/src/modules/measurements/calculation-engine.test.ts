import { describe, expect, it } from 'vitest'

import { calculateMeasurement } from './calculation-engine.js'

describe('measurement calculation engine', () => {
  it('applies a whitelisted length formula and inputs', () => {
    const result = calculateMeasurement(
      1_000,
      'line',
      { frequency: 2, service_days: 30, side_factor: 2 },
      {
        calculationVersion: 1,
        calculationSpec: {
          expression: 'length_m * side_factor * frequency * service_days',
          requiredInputs: ['side_factor', 'frequency', 'service_days'],
          ruleCode: 'RULE-LENGTH-FREQUENCY-1',
        },
      },
    )
    expect(result.quantity).toBe(120_000)
    expect(result.warnings).toEqual([])
  })

  it('does not calculate when a required input is missing', () => {
    const result = calculateMeasurement(
      10_000,
      'area',
      {},
      {
        calculationSpec: {
          expression: 'area_m2 * frequency',
          requiredInputs: ['frequency'],
        },
      },
    )
    expect(result.quantity).toBeNull()
    expect(result.warnings[0]?.code).toBe('MISSING_CALCULATION_INPUT')
    expect(result.warnings[0]?.severity).toBe('error')
  })

  it('rejects expressions outside the multiplication whitelist', () => {
    const result = calculateMeasurement(
      10,
      'line',
      {},
      {
        calculationSpec: { expression: 'length_m + 1' },
      },
    )
    expect(result.quantity).toBeNull()
    expect(result.warnings[0]?.severity).toBe('error')
  })
})
