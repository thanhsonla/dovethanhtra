import type { Measurement, MeasurementGeometryKind, MeasurementListResponse } from '@dove/contracts'

const baseUnits: Record<MeasurementGeometryKind, string> = {
  area: 'm²',
  line: 'm',
  point: 'điểm',
  route: 'm',
}

const partNames: Record<MeasurementGeometryKind, string> = {
  area: 'Vùng',
  line: 'Đoạn',
  point: 'Điểm',
  route: 'Tuyến',
}

export function formatQuantity(value: number | null | undefined, unit: string): string {
  if (value === null || value === undefined) return 'Chưa tính'
  const targetUnit = unit || ''
  if ((targetUnit === 'm²' || targetUnit === 'ha') && value >= 10000) {
    const ha = value / 10000
    return `${ha.toLocaleString('vi-VN', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    })} ha`
  }
  return `${value.toLocaleString('vi-VN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })} ${targetUnit}`.trim()
}

export function measurementBaseValue(measurement: Measurement): string {
  return formatQuantity(measurement.baseValue, baseUnits[measurement.geometryKind])
}

export function measurementBaseTotal(measurements: Measurement[]): string {
  const active = measurements.filter(
    (item) => !item.deletedAt && item.status !== 'superseded' && item.baseValue !== null,
  )
  const kind = active[0]?.geometryKind ?? measurements[0]?.geometryKind
  if (!kind) return 'Chưa tính'
  return formatQuantity(
    active.reduce((total, item) => total + (item.baseValue ?? 0), 0),
    baseUnits[kind],
  )
}

export function measurementQuantity(measurement: Measurement): string {
  return formatQuantity(measurement.calculatedQuantity, measurement.unit)
}

export function measurementPartLabel(measurement: Measurement, index: number): string {
  return `${partNames[measurement.geometryKind]} ${index + 1}`
}

export function confirmedSummary(summary: MeasurementListResponse | undefined): {
  count: number
  total: string
} {
  const confirmed = summary?.items.filter((item) => item.status === 'confirmed').length ?? 0
  return {
    count: confirmed,
    total: formatQuantity(summary?.confirmedTotal ?? 0, summary?.unit ?? ''),
  }
}
