import { createHash } from 'node:crypto'

import type { QueryExecutor } from '../../platform/database.js'
import { sql } from 'kysely'

interface BoundaryGeometry {
  coordinates: unknown
  type: 'MultiPolygon' | 'Polygon'
}

export interface AdminAreaImportRecord {
  areaType: string
  code: string
  geometry: BoundaryGeometry
  name: string
  source: string
  sourceVersion: string
  validFrom: string
  validTo: string | null
}

export interface ParsedAdminAreaImport {
  records: AdminAreaImportRecord[]
  sourceHash: string
}

type JsonObject = Record<string, unknown>

function object(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} phải là object.`)
  }
  return value as JsonObject
}

function requiredString(value: unknown, label: string, maximum = 300): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > maximum) {
    throw new Error(`${label} phải là chuỗi từ 1 đến ${maximum} ký tự.`)
  }
  return value.trim()
}

function date(value: unknown, label: string, nullable = false): string | null {
  if (nullable && (value === null || value === undefined)) return null
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} phải có định dạng YYYY-MM-DD.`)
  }
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(parsed.valueOf()) || !parsed.toISOString().startsWith(value)) {
    throw new Error(`${label} không phải ngày hợp lệ.`)
  }
  return value
}

function position(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === 'number' &&
    Number.isFinite(value[0]) &&
    value[0] >= -180 &&
    value[0] <= 180 &&
    typeof value[1] === 'number' &&
    Number.isFinite(value[1]) &&
    value[1] >= -90 &&
    value[1] <= 90
  )
}

function ring(value: unknown): number | null {
  if (!Array.isArray(value) || value.length < 4 || !value.every(position)) return null
  const first = value[0]
  const last = value[value.length - 1]
  if (!first || !last || first[0] !== last[0] || first[1] !== last[1]) return null
  return value.length
}

function polygon(value: unknown): number | null {
  if (!Array.isArray(value) || value.length === 0) return null
  let total = 0
  for (const item of value) {
    const positions = ring(item)
    if (positions === null) return null
    total += positions
  }
  return total
}

function geometry(value: unknown, index: number): BoundaryGeometry {
  const input = object(value, `features[${index}].geometry`)
  if (input.type !== 'Polygon' && input.type !== 'MultiPolygon') {
    throw new Error(`features[${index}].geometry chỉ hỗ trợ Polygon/MultiPolygon.`)
  }
  let positions = 0
  if (input.type === 'Polygon') {
    const count = polygon(input.coordinates)
    if (count === null) throw new Error(`features[${index}].geometry có tọa độ không hợp lệ.`)
    positions = count
  } else {
    if (!Array.isArray(input.coordinates) || input.coordinates.length === 0) {
      throw new Error(`features[${index}].geometry có tọa độ không hợp lệ.`)
    }
    for (const item of input.coordinates) {
      const count = polygon(item)
      if (count === null) throw new Error(`features[${index}].geometry có tọa độ không hợp lệ.`)
      positions += count
    }
  }
  if (positions > 200_000) {
    throw new Error(`features[${index}].geometry vượt giới hạn 200.000 tọa độ.`)
  }
  return { coordinates: input.coordinates, type: input.type }
}

export function parseAdminAreaGeoJson(content: Buffer): ParsedAdminAreaImport {
  if (content.byteLength > 20_000_000) throw new Error('GeoJSON vượt giới hạn 20 MB.')
  let parsed: unknown
  try {
    parsed = JSON.parse(content.toString('utf8'))
  } catch {
    throw new Error('Tệp không phải JSON hợp lệ.')
  }
  const collection = object(parsed, 'GeoJSON')
  if (collection.type !== 'FeatureCollection' || !Array.isArray(collection.features)) {
    throw new Error('GeoJSON phải là FeatureCollection.')
  }
  if (Object.hasOwn(collection, 'crs')) {
    throw new Error('Không nhận trường crs; dữ liệu phải được chuẩn hóa sẵn về EPSG:4326.')
  }
  if (collection.features.length === 0 || collection.features.length > 1_000) {
    throw new Error('FeatureCollection phải có từ 1 đến 1.000 địa bàn.')
  }
  const seen = new Set<string>()
  const records = collection.features.map((value, index): AdminAreaImportRecord => {
    const feature = object(value, `features[${index}]`)
    if (feature.type !== 'Feature') throw new Error(`features[${index}] phải có type Feature.`)
    const properties = object(feature.properties, `features[${index}].properties`)
    const code = requiredString(properties.code, `features[${index}].properties.code`, 100)
    if (!/^[A-Z0-9_-]+$/.test(code)) {
      throw new Error(`features[${index}].properties.code chỉ dùng A-Z, 0-9, _ và -.`)
    }
    const sourceVersion = requiredString(
      properties.sourceVersion,
      `features[${index}].properties.sourceVersion`,
      200,
    )
    const identity = `${code}\0${sourceVersion}`
    if (seen.has(identity)) throw new Error(`Trùng code/sourceVersion tại features[${index}].`)
    seen.add(identity)
    const validFrom = date(properties.validFrom, `features[${index}].properties.validFrom`)
    const validTo = date(properties.validTo, `features[${index}].properties.validTo`, true)
    if (validTo && validFrom && validTo < validFrom) {
      throw new Error(`features[${index}] có validTo trước validFrom.`)
    }
    return {
      areaType: requiredString(properties.areaType, `features[${index}].properties.areaType`, 100),
      code,
      geometry: geometry(feature.geometry, index),
      name: requiredString(properties.name, `features[${index}].properties.name`),
      source: requiredString(properties.source, `features[${index}].properties.source`, 500),
      sourceVersion,
      validFrom: validFrom!,
      validTo,
    }
  })
  return { records, sourceHash: createHash('sha256').update(content).digest('hex') }
}

export async function importAdminAreas(
  executor: QueryExecutor,
  input: ParsedAdminAreaImport,
): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0
  let skipped = 0
  for (const record of input.records) {
    const geometryJson = JSON.stringify(record.geometry)
    const analysis = await sql<{ reason: string; valid: boolean }>`
      SELECT ST_IsValid(candidate) AS valid, ST_IsValidReason(candidate) AS reason
      FROM (
        SELECT ST_SetSRID(ST_GeomFromGeoJSON(${geometryJson}), 4326) AS candidate
      ) input
    `.execute(executor)
    if (!analysis.rows[0]?.valid) {
      throw new Error(
        `Ranh giới ${record.code}/${record.sourceVersion} không hợp lệ: ${analysis.rows[0]?.reason ?? 'không rõ'}.`,
      )
    }
    const existing = await sql<{ sourceHash: string | null }>`
      SELECT source_hash AS "sourceHash" FROM admin_area
      WHERE code = ${record.code} AND source_version = ${record.sourceVersion}
    `.execute(executor)
    if (existing.rows[0]) {
      if (existing.rows[0].sourceHash === input.sourceHash) {
        skipped += 1
        continue
      }
      throw new Error(
        `Địa bàn ${record.code}/${record.sourceVersion} đã tồn tại với hash khác; phải dùng sourceVersion mới.`,
      )
    }
    await sql`
      INSERT INTO admin_area (
        code, name, area_type, valid_from, valid_to, boundary,
        source, source_version, source_hash, metadata
      ) VALUES (
        ${record.code}, ${record.name}, ${record.areaType}, ${record.validFrom}::date,
        ${record.validTo}::date,
        ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(${geometryJson}), 4326)),
        ${record.source}, ${record.sourceVersion}, ${input.sourceHash},
        ${JSON.stringify({ importedBy: 'admin-area-cli' })}::jsonb
      )
    `.execute(executor)
    inserted += 1
  }
  return { inserted, skipped }
}
