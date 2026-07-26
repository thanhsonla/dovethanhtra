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

function polygonRings(geometry: GeoJsonGeometry | null): Position[][] | null {
  if (!geometry || geometry.type !== 'Polygon') return null
  return geometry.coordinates as Position[][]
}

function openRing(ring: Position[]): Position[] {
  if (ring.length < 2) return ring
  const first = ring[0]
  const last = ring.at(-1)
  return first && last && first[0] === last[0] && first[1] === last[1] ? ring.slice(0, -1) : ring
}

function closeRing(ring: Position[]): Position[] {
  const opened = openRing(ring)
  return opened[0] ? [...opened, opened[0]] : opened
}

function pointOnSegment(point: Position, start: Position, end: Position): boolean {
  const cross =
    (point[1] - start[1]) * (end[0] - start[0]) - (point[0] - start[0]) * (end[1] - start[1])
  if (Math.abs(cross) > 1e-12) return false
  return (
    point[0] >= Math.min(start[0], end[0]) &&
    point[0] <= Math.max(start[0], end[0]) &&
    point[1] >= Math.min(start[1], end[1]) &&
    point[1] <= Math.max(start[1], end[1])
  )
}

function pointStrictlyInsideRing(point: Position, ring: Position[]): boolean {
  const points = openRing(ring)
  let inside = false
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
    const start = points[previous]
    const end = points[index]
    if (!start || !end) continue
    if (pointOnSegment(point, start, end)) return false
    const crosses =
      start[1] > point[1] !== end[1] > point[1] &&
      point[0] < ((end[0] - start[0]) * (point[1] - start[1])) / (end[1] - start[1]) + start[0]
    if (crosses) inside = !inside
  }
  return inside
}

function orientation(first: Position, second: Position, third: Position): number {
  return (
    (second[0] - first[0]) * (third[1] - first[1]) - (second[1] - first[1]) * (third[0] - first[0])
  )
}

function segmentsIntersect(
  firstStart: Position,
  firstEnd: Position,
  secondStart: Position,
  secondEnd: Position,
): boolean {
  const a = orientation(firstStart, firstEnd, secondStart)
  const b = orientation(firstStart, firstEnd, secondEnd)
  const c = orientation(secondStart, secondEnd, firstStart)
  const d = orientation(secondStart, secondEnd, firstEnd)
  if (((a > 0 && b < 0) || (a < 0 && b > 0)) && ((c > 0 && d < 0) || (c < 0 && d > 0))) {
    return true
  }
  return (
    (Math.abs(a) <= 1e-12 && pointOnSegment(secondStart, firstStart, firstEnd)) ||
    (Math.abs(b) <= 1e-12 && pointOnSegment(secondEnd, firstStart, firstEnd)) ||
    (Math.abs(c) <= 1e-12 && pointOnSegment(firstStart, secondStart, secondEnd)) ||
    (Math.abs(d) <= 1e-12 && pointOnSegment(firstEnd, secondStart, secondEnd))
  )
}

function ringsIntersect(first: Position[], second: Position[]): boolean {
  const firstClosed = closeRing(first)
  const secondClosed = closeRing(second)
  for (let firstIndex = 1; firstIndex < firstClosed.length; firstIndex += 1) {
    const firstStart = firstClosed[firstIndex - 1]
    const firstEnd = firstClosed[firstIndex]
    if (!firstStart || !firstEnd) continue
    for (let secondIndex = 1; secondIndex < secondClosed.length; secondIndex += 1) {
      const secondStart = secondClosed[secondIndex - 1]
      const secondEnd = secondClosed[secondIndex]
      if (
        secondStart &&
        secondEnd &&
        segmentsIntersect(firstStart, firstEnd, secondStart, secondEnd)
      ) {
        return true
      }
    }
  }
  return false
}

function ringsOverlap(first: Position[], second: Position[]): boolean {
  if (ringsIntersect(first, second)) return true
  const firstPoint = openRing(first)[0]
  const secondPoint = openRing(second)[0]
  return Boolean(
    (firstPoint && pointStrictlyInsideRing(firstPoint, second)) ||
    (secondPoint && pointStrictlyInsideRing(secondPoint, first)),
  )
}

export function addPolygonHole(
  baseGeometry: GeoJsonGeometry,
  subtractionGeometry: GeoJsonGeometry,
): GeoJsonGeometry {
  const baseRings = polygonRings(baseGeometry)
  const subtractionRings = polygonRings(subtractionGeometry)
  const outer = baseRings?.[0]
  const subtraction = subtractionRings?.[0]
  if (!baseRings || !outer || !subtractionRings || !subtraction) {
    throw new Error('Nút Bớt chỉ áp dụng cho một đối tượng diện tích dạng polygon.')
  }
  const subtractionPoints = openRing(subtraction)
  if (
    subtractionPoints.length < 3 ||
    subtractionPoints.some((point) => !pointStrictlyInsideRing(point, outer)) ||
    ringsIntersect(outer, subtraction)
  ) {
    throw new Error('Vùng bớt phải nằm hoàn toàn bên trong diện tích đối tượng đã chọn.')
  }
  if (baseRings.slice(1).some((existing) => ringsOverlap(existing, subtraction))) {
    throw new Error('Vùng bớt mới không được giao hoặc nằm trong vùng bớt đã có.')
  }
  return {
    coordinates: [closeRing(outer), ...baseRings.slice(1).map(closeRing), closeRing(subtraction)],
    type: 'Polygon',
  }
}

export function polygonHoleGeometries(geometry: GeoJsonGeometry | null): GeoJsonGeometry[] {
  if (!geometry) return []
  if (geometry.type === 'Polygon') {
    return (geometry.coordinates as Position[][])
      .slice(1)
      .map((ring) => ({ coordinates: [closeRing(ring)], type: 'Polygon' as const }))
  }
  if (geometry.type === 'MultiPolygon') {
    return (geometry.coordinates as Position[][][])
      .flatMap((polygon) => polygon.slice(1))
      .map((ring) => ({ coordinates: [closeRing(ring)], type: 'Polygon' as const }))
  }
  return []
}

export function polygonHoleAreasMeters(geometry: GeoJsonGeometry | null): number[] {
  return polygonHoleGeometries(geometry).map((hole) =>
    area({ type: 'Feature' as const, properties: {}, geometry: hole }),
  )
}

export function polygonOuterAreaMeters(geometry: GeoJsonGeometry | null): number | null {
  const rings = polygonRings(geometry)
  const outer = rings?.[0]
  if (!outer) return null
  return area({
    type: 'Feature' as const,
    properties: {},
    geometry: { coordinates: [closeRing(outer)], type: 'Polygon' as const },
  })
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
