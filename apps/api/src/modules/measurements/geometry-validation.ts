import type { DrawableMeasurementGeometryKind, GeoJsonGeometry } from '@dove/contracts'

import { AppError } from '../../platform/app-error.js'

const allowedTypes: Record<DrawableMeasurementGeometryKind, GeoJsonGeometry['type'][]> = {
  area: ['Polygon', 'MultiPolygon'],
  line: ['LineString', 'MultiLineString'],
  point: ['Point', 'MultiPoint'],
}

type PositionLike = [number, number, ...unknown[]]

function validatePosition(value: unknown): value is PositionLike {
  if (!Array.isArray(value) || value.length < 2) return false
  const coordinates = value as unknown[]
  const longitude: unknown = coordinates[0]
  const latitude: unknown = coordinates[1]
  return (
    typeof longitude === 'number' &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180 &&
    typeof latitude === 'number' &&
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90
  )
}

function isPositionArray(value: unknown, minimum: number): value is unknown[] {
  return Array.isArray(value) && value.length >= minimum && value.every(validatePosition)
}

function samePosition(first: unknown, last: unknown): boolean {
  if (!validatePosition(first) || !validatePosition(last)) return false
  return first[0] === last[0] && first[1] === last[1]
}

function isRing(value: unknown): value is unknown[] {
  return isPositionArray(value, 4) && samePosition(value[0], value[value.length - 1])
}

function coordinateCount(geometry: GeoJsonGeometry): number | null {
  const coordinates = geometry.coordinates
  if (geometry.type === 'Point') return validatePosition(coordinates) ? 1 : null
  if (geometry.type === 'MultiPoint' || geometry.type === 'LineString') {
    const minimum = geometry.type === 'LineString' ? 2 : 1
    return isPositionArray(coordinates, minimum) ? coordinates.length : null
  }
  if (geometry.type === 'MultiLineString') {
    if (!Array.isArray(coordinates) || coordinates.length === 0) return null
    return coordinates.every((line) => isPositionArray(line, 2))
      ? coordinates.reduce((total, line) => total + line.length, 0)
      : null
  }
  if (geometry.type === 'Polygon') {
    if (!Array.isArray(coordinates) || coordinates.length === 0) return null
    return coordinates.every(isRing)
      ? coordinates.reduce((total, ring) => total + ring.length, 0)
      : null
  }
  if (!Array.isArray(coordinates) || coordinates.length === 0) return null
  let total = 0
  for (const polygon of coordinates) {
    if (!Array.isArray(polygon) || polygon.length === 0 || !polygon.every(isRing)) return null
    total += polygon.reduce((count, ring) => count + ring.length, 0)
  }
  return total
}

export function validateGeoJsonInput(
  geometry: GeoJsonGeometry,
  geometryKind: DrawableMeasurementGeometryKind,
): void {
  if (!allowedTypes[geometryKind].includes(geometry.type)) {
    throw new AppError(422, 'GEOMETRY_KIND_MISMATCH', 'Kiểu GeoJSON không khớp kiểu đo.')
  }
  const serializedSize = Buffer.byteLength(JSON.stringify(geometry))
  if (serializedSize > 500_000) {
    throw new AppError(413, 'GEOMETRY_TOO_LARGE', 'GeoJSON vượt giới hạn 500 KB của Mốc 2.')
  }
  const positions = coordinateCount(geometry)
  if (positions === null) {
    throw new AppError(
      422,
      'COORDINATES_INVALID',
      'Cấu trúc GeoJSON hoặc tọa độ [longitude, latitude] không hợp lệ.',
    )
  }
  if (positions > 10_000) {
    throw new AppError(413, 'TOO_MANY_COORDINATES', 'GeoJSON vượt giới hạn 10.000 tọa độ.')
  }
}
