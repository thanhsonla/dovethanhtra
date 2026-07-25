import area from '@turf/area'
import length from '@turf/length'
import type { GeoJsonGeometry, MeasurementGeometryKind, WorkItem } from '@dove/contracts'

import type { Position } from './measurement-map.js'

const inputHelp: Record<string, { description: string; label: string; placeholder?: string }> = {
  frequency: {
    description: 'Số lần thực hiện trong một ngày hoặc một kỳ theo hồ sơ công tác.',
    label: 'Tần suất thực hiện',
    placeholder: 'Ví dụ: 1',
  },
  occurrence_count: {
    description: 'Số lượt hoặc số lần phát sinh được tính cho bộ phận đo này.',
    label: 'Số lượt phát sinh',
    placeholder: 'Ví dụ: 1',
  },
  service_days: {
    description: 'Số ngày dịch vụ được tính trong kỳ kiểm tra.',
    label: 'Số ngày thực hiện',
    placeholder: 'Ví dụ: 30',
  },
  side_factor: {
    description:
      'Hệ số mặt đường: 1 là một bên/một mặt, 2 là hai bên/hai mặt nếu hợp đồng quy định.',
    label: 'Hệ số mặt/tuyến',
    placeholder: '1 hoặc 2',
  },
}

export function geometryFromPositions(
  kind: MeasurementGeometryKind,
  points: Position[],
): GeoJsonGeometry | null {
  if (kind === 'point' && points[0]) return { type: 'Point', coordinates: points[0] }
  if (kind === 'line' && points.length >= 2) return { type: 'LineString', coordinates: points }
  if (kind === 'area' && points.length >= 3) {
    return { type: 'Polygon', coordinates: [[...points, points[0]!]] }
  }
  return null
}

export function polygonPerimeterMeters(geometry: GeoJsonGeometry | null): number | null {
  if (!geometry) return null
  if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
    const feature = { type: 'Feature' as const, properties: {}, geometry }
    return length(feature) * 1000
  }
  return null
}

export function temporaryValue(geometry: GeoJsonGeometry | null): string {
  if (!geometry) return 'Chưa đủ điểm'
  const feature = { type: 'Feature' as const, properties: {}, geometry }
  if (geometry.type === 'LineString') return `${(length(feature) * 1000).toFixed(2)} m`
  if (geometry.type === 'Polygon') return `${area(feature).toFixed(2)} m²`
  return '1 điểm'
}

export function positionsFromGeometry(geometry: GeoJsonGeometry | null): Position[] {
  if (!geometry) return []
  if (geometry.type === 'Point') return [geometry.coordinates as Position]
  if (geometry.type === 'LineString') return geometry.coordinates as Position[]
  if (geometry.type === 'Polygon')
    return ((geometry.coordinates as Position[][])[0] ?? []).slice(0, -1)
  return []
}

export function requiredInputs(workItem: WorkItem | null): string[] {
  const spec = workItem?.formulaSnapshot.calculationSpec
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return []
  const required = (spec as Record<string, unknown>).requiredInputs
  return Array.isArray(required)
    ? required.filter((item): item is string => typeof item === 'string')
    : []
}

export function calculationInputMeta(name: string): {
  description: string
  label: string
  placeholder?: string
} {
  return inputHelp[name] ?? { description: `Đầu vào công thức: ${name}.`, label: name }
}
