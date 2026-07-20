import type { DrawableMeasurementGeometryKind, Measurement, WorkItem } from '@dove/contracts'

import { requiredInputs } from './map-geometry.js'

const partLabels: Record<DrawableMeasurementGeometryKind, string> = {
  area: 'Vùng',
  line: 'Đoạn',
  point: 'Điểm',
}

export function nextMeasurementName(
  kind: DrawableMeasurementGeometryKind,
  measurements: Measurement[],
): string {
  const sequence =
    measurements.filter((item) => item.geometryKind === kind && item.status !== 'superseded')
      .length + 1
  return `${partLabels[kind]} ${String(sequence).padStart(2, '0')}`
}

export function inheritedCalculationInputs(
  workItem: WorkItem | null,
  measurements: Measurement[],
): Record<string, number> {
  const names = requiredInputs(workItem)
  const recent = measurements
    .filter((item) => item.status !== 'superseded')
    .toSorted((left, right) => right.updatedAt.localeCompare(left.updatedAt))

  return Object.fromEntries(
    names.flatMap((name) => {
      const value = recent
        .map((item) => item.calculationInputs[name])
        .find((item) => typeof item === 'number' && Number.isFinite(item) && item >= 0)
      return value === undefined ? [] : [[name, value]]
    }),
  )
}
