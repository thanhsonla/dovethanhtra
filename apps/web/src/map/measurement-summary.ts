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
  return `${value.toLocaleString('vi-VN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })} ${unit}`
}

export function measurementBaseValue(measurement: Measurement): string {
  return formatQuantity(measurement.baseValue, baseUnits[measurement.geometryKind])
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
