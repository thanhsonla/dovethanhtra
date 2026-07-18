import type { MeasurementGeometryKind, MeasurementWarning } from '@dove/contracts'

interface CalculationSpec {
  expression?: unknown
  requiredInputs?: unknown
  ruleCode?: unknown
  version?: unknown
}

export interface FormulaSnapshot {
  calculationSpec?: CalculationSpec
  calculationVersion?: unknown
}

export interface CalculationResult {
  calculationVersion: number
  expression: string
  quantity: number | null
  ruleCode: string
  warnings: MeasurementWarning[]
}

const baseVariable: Record<MeasurementGeometryKind, string> = {
  area: 'area_m2',
  line: 'length_m',
  point: 'count',
}

function numericFactor(token: string, variables: Record<string, number>): number | null {
  if (/^\d+(?:\.\d+)?$/.test(token)) return Number(token)
  const sumMatch = token.match(/^sum\(([a-zA-Z_][a-zA-Z0-9_]*)\)$/)
  const name = sumMatch?.[1] ?? token
  return Object.hasOwn(variables, name) ? variables[name]! : null
}

export function calculateMeasurement(
  baseValue: number | null,
  geometryKind: MeasurementGeometryKind,
  inputs: Record<string, number>,
  snapshot: FormulaSnapshot,
): CalculationResult {
  const spec = snapshot.calculationSpec ?? {}
  const expression =
    typeof spec.expression === 'string' ? spec.expression : baseVariable[geometryKind]
  const ruleCode = typeof spec.ruleCode === 'string' ? spec.ruleCode : 'RULE-BASE-1'
  const calculationVersion =
    typeof snapshot.calculationVersion === 'number'
      ? snapshot.calculationVersion
      : typeof spec.version === 'number'
        ? spec.version
        : 1
  const requiredInputs = Array.isArray(spec.requiredInputs)
    ? spec.requiredInputs.filter((item): item is string => typeof item === 'string')
    : []
  const missing = requiredInputs.filter((name) => !Object.hasOwn(inputs, name))
  if (baseValue === null || missing.length > 0) {
    return {
      calculationVersion,
      expression,
      quantity: null,
      ruleCode,
      warnings: missing.length
        ? [
            {
              code: 'MISSING_CALCULATION_INPUT',
              severity: 'error',
              message: 'Thiếu đầu vào bắt buộc để tính khối lượng.',
              details: { fields: missing },
            },
          ]
        : [],
    }
  }

  const variables = { ...inputs, [baseVariable[geometryKind]]: baseValue }
  const tokens = expression.replace(/\s+/g, '').split('*')
  const factors = tokens.map((token) => numericFactor(token, variables))
  if (factors.some((factor) => factor === null)) {
    return {
      calculationVersion,
      expression,
      quantity: null,
      ruleCode,
      warnings: [
        {
          code: 'UNSUPPORTED_CALCULATION_EXPRESSION',
          severity: 'error',
          message: 'Biểu thức có biến hoặc phép toán chưa được whitelist.',
        },
      ],
    }
  }
  const numericFactors = factors.filter((factor): factor is number => factor !== null)
  const quantity = numericFactors.reduce((value, factor) => value * factor, 1)
  if (!Number.isFinite(quantity) || quantity < 0) {
    return {
      calculationVersion,
      expression,
      quantity: null,
      ruleCode,
      warnings: [
        {
          code: 'CALCULATION_RESULT_INVALID',
          severity: 'error',
          message: 'Kết quả công thức không phải số hữu hạn không âm.',
        },
      ],
    }
  }

  return {
    calculationVersion,
    expression,
    quantity,
    ruleCode,
    warnings: [],
  }
}
