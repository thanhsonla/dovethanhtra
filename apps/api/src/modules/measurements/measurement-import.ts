import { createHash } from 'node:crypto'

import type { DrawableMeasurementGeometryKind, GeoJsonGeometry } from '@dove/contracts'

import { AppError } from '../../platform/app-error.js'
import { validateGeoJsonInput } from './geometry-validation.js'

interface ParsedFeature {
  geometry: GeoJsonGeometry
  name: string
}

export interface ParsedMeasurementImport {
  detectedSchema: Array<{ name: string; types: Array<'boolean' | 'null' | 'number' | 'string'> }>
  features: ParsedFeature[]
  geometryKind: DrawableMeasurementGeometryKind
  sizeBytes: number
  sourceHash: string
}

const object = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null

function kindFor(type: string): DrawableMeasurementGeometryKind | null {
  if (type === 'Point' || type === 'MultiPoint') return 'point'
  if (type === 'LineString' || type === 'MultiLineString') return 'line'
  if (type === 'Polygon' || type === 'MultiPolygon') return 'area'
  return null
}

export function parseMeasurementImport(
  collection: unknown,
  nameProperty = 'name',
): ParsedMeasurementImport {
  const serialized = JSON.stringify(collection)
  const sizeBytes = Buffer.byteLength(serialized)
  if (sizeBytes > 5_000_000)
    throw new AppError(413, 'IMPORT_TOO_LARGE', 'GeoJSON vượt giới hạn 5 MB.')
  const root = object(collection)
  if (!root || root.type !== 'FeatureCollection' || !Array.isArray(root.features)) {
    throw new AppError(422, 'IMPORT_COLLECTION_INVALID', 'GeoJSON phải là FeatureCollection.')
  }
  if (root.features.length < 1 || root.features.length > 1000) {
    throw new AppError(422, 'IMPORT_FEATURE_LIMIT', 'GeoJSON phải có từ 1 đến 1.000 feature.')
  }
  if (root.crs && !JSON.stringify(root.crs).includes('4326')) {
    throw new AppError(422, 'IMPORT_CRS_INVALID', 'GeoJSON import phải dùng EPSG:4326.')
  }
  const schema = new Map<string, Set<'boolean' | 'null' | 'number' | 'string'>>()
  let geometryKind: DrawableMeasurementGeometryKind | null = null
  const features = root.features.map((raw, index): ParsedFeature => {
    const feature = object(raw)
    const geometry = object(feature?.geometry)
    const properties = object(feature?.properties) ?? {}
    if (!feature || feature.type !== 'Feature' || !geometry || typeof geometry.type !== 'string') {
      throw new AppError(422, 'IMPORT_FEATURE_INVALID', `Feature ${index + 1} không hợp lệ.`)
    }
    const kind = kindFor(geometry.type)
    if (!kind)
      throw new AppError(
        422,
        'IMPORT_GEOMETRY_UNSUPPORTED',
        `Feature ${index + 1} có geometry không hỗ trợ.`,
      )
    if (geometryKind && geometryKind !== kind) {
      throw new AppError(422, 'IMPORT_GEOMETRY_MIXED', 'Một batch chỉ được chứa một kiểu geometry.')
    }
    geometryKind = kind
    validateGeoJsonInput(geometry as unknown as GeoJsonGeometry, kind)
    const entries = Object.entries(properties)
    if (entries.length > 50)
      throw new AppError(422, 'IMPORT_PROPERTY_LIMIT', `Feature ${index + 1} có quá 50 thuộc tính.`)
    for (const [key, value] of entries) {
      if (key.length > 100)
        throw new AppError(422, 'IMPORT_PROPERTY_INVALID', 'Tên thuộc tính vượt 100 ký tự.')
      const type = value === null ? 'null' : typeof value
      if (
        !['boolean', 'null', 'number', 'string'].includes(type) ||
        (typeof value === 'string' && value.length > 1000) ||
        (typeof value === 'number' && !Number.isFinite(value))
      ) {
        throw new AppError(
          422,
          'IMPORT_PROPERTY_INVALID',
          `Thuộc tính ${key} không phải giá trị scalar hợp lệ.`,
        )
      }
      const types = schema.get(key) ?? new Set()
      types.add(type as 'boolean' | 'null' | 'number' | 'string')
      schema.set(key, types)
    }
    const requestedName = properties[nameProperty]
    return {
      geometry: geometry as unknown as GeoJsonGeometry,
      name:
        typeof requestedName === 'string' && requestedName.trim()
          ? requestedName.trim().slice(0, 300)
          : `Đối tượng import ${index + 1}`,
    }
  })
  return {
    detectedSchema: [...schema.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, types]) => ({
        name,
        types: [...types].sort(),
      })),
    features,
    geometryKind: geometryKind!,
    sizeBytes,
    sourceHash: createHash('sha256').update(serialized).digest('hex'),
  }
}
