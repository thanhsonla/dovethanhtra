import area from '@turf/area'
import length from '@turf/length'
import type { GeoJsonGeometry, MeasurementGeometryKind, WorkItem } from '@dove/contracts'

import type { Position } from './measurement-map.js'

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

export function temporaryValue(geometry: GeoJsonGeometry | null): string {
  if (!geometry) return 'Chưa đủ điểm'
  const feature = { type: 'Feature' as const, properties: {}, geometry }
  if (geometry.type === 'LineString') return `${(length(feature) * 1000).toFixed(2)} m`
  if (geometry.type === 'Polygon') return `${area(feature).toFixed(2)} m²`
  return '1 điểm'
}

export function requiredInputs(workItem: WorkItem | null): string[] {
  const spec = workItem?.formulaSnapshot.calculationSpec
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return []
  const required = (spec as Record<string, unknown>).requiredInputs
  return Array.isArray(required)
    ? required.filter((item): item is string => typeof item === 'string')
    : []
}
