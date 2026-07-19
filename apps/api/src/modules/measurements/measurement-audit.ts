import type { Measurement } from '@dove/contracts'

export function measurementAuditSummary(measurement: Measurement): Record<string, unknown> {
  return {
    baseValue: measurement.baseValue,
    calculatedQuantity: measurement.calculatedQuantity,
    code: measurement.code,
    id: measurement.id,
    status: measurement.status,
    validationStatus: measurement.validationStatus,
    version: measurement.version,
    warningCodes: measurement.warnings.map((warning) => warning.code),
    workItemId: measurement.workItemId,
  }
}
