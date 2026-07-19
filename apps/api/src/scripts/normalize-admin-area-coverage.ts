import { createHash } from 'node:crypto'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { sql } from 'kysely'

import { loadConfig } from '../config.js'
import { parseAdminAreaGeoJson } from '../modules/admin-areas/admin-area-import.js'
import { createDatabase, type QueryExecutor } from '../platform/database.js'

const BASE_VERSION = 'son-la-75-qdt19-2025-gis-20260311-86361845'
const OUTPUT_VERSION = 'son-la-75-qdt19-2025-gis-20260311-topology-20260719-v1'
const OUTPUT_VALID_FROM = '2026-07-19'
const ALGORITHM_VERSION = 'area-target-min-absolute-error-v1'
const OVERLAP_TOLERANCE_M2 = 0.01

interface GeoJsonFeature {
  geometry: { coordinates: unknown; type: 'MultiPolygon' | 'Polygon' }
  properties: Record<string, unknown>
  type: 'Feature'
}

interface AreaTarget {
  code: string
  name: string
  targetAreaKm2: number
}

interface CoverageOperation {
  keptCode: string
  overlapAreaM2: number
  trimmedCode: string
}

interface WorkRow {
  aAreaM2: number
  aCode: string
  aTargetM2: number
  bAreaM2: number
  bCode: string
  bTargetM2: number
  overlapAreaM2: number
}

interface OverlapPair {
  aCode: string
  bCode: string
}

const workspaceRoot = fileURLToPath(new URL('../../../../', import.meta.url))

async function inputPath(argument: string): Promise<string> {
  if (isAbsolute(argument)) return argument
  for (const candidate of [resolve(process.cwd(), argument), resolve(workspaceRoot, argument)]) {
    try {
      await access(candidate)
      return candidate
    } catch {
      // Thử đường dẫn tiếp theo.
    }
  }
  return resolve(workspaceRoot, argument)
}

function outputPath(argument: string): string {
  return isAbsolute(argument) ? argument : resolve(workspaceRoot, argument)
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} phải là object.`)
  }
  return value as Record<string, unknown>
}

function string(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} phải là chuỗi không rỗng.`)
  }
  return value.trim()
}

async function insertWorkGeometry(
  executor: QueryExecutor,
  feature: GeoJsonFeature,
  target: AreaTarget,
): Promise<void> {
  await sql`
    INSERT INTO coverage_work (code, target_area_m2, geom)
    VALUES (
      ${target.code},
      ${target.targetAreaKm2 * 1_000_000},
      ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(feature.geometry)}), 4326))
    )
  `.execute(executor)
}

async function listOverlapPairs(executor: QueryExecutor): Promise<OverlapPair[]> {
  const result = await sql<OverlapPair>`
    SELECT a.code AS "aCode", b.code AS "bCode"
    FROM coverage_work a
    JOIN coverage_work b ON a.code < b.code AND a.geom && b.geom
    WHERE ST_Overlaps(a.geom, b.geom)
      AND ST_Area(ST_Intersection(a.geom, b.geom)::geography) > ${OVERLAP_TOLERANCE_M2}
    ORDER BY ST_Area(ST_Intersection(a.geom, b.geom)::geography) DESC, a.code, b.code
  `.execute(executor)
  return result.rows
}

async function readOverlap(
  executor: QueryExecutor,
  aCode: string,
  bCode: string,
): Promise<WorkRow | undefined> {
  const result = await sql<WorkRow>`
    SELECT
      a.code AS "aCode",
      b.code AS "bCode",
      ST_Area(a.geom::geography) AS "aAreaM2",
      ST_Area(b.geom::geography) AS "bAreaM2",
      a.target_area_m2 AS "aTargetM2",
      b.target_area_m2 AS "bTargetM2",
      ST_Area(ST_Intersection(a.geom, b.geom)::geography) AS "overlapAreaM2"
    FROM coverage_work a
    JOIN coverage_work b ON b.code = ${bCode}
    WHERE a.code = ${aCode} AND ST_Overlaps(a.geom, b.geom)
  `.execute(executor)
  return result.rows[0]
}

async function trimOverlap(
  executor: QueryExecutor,
  trimmedCode: string,
  keptCode: string,
): Promise<void> {
  await sql`
    UPDATE coverage_work trimmed
    SET geom = ST_Multi(
      ST_CollectionExtract(ST_Difference(trimmed.geom, kept.geom), 3)
    )
    FROM coverage_work kept
    WHERE trimmed.code = ${trimmedCode} AND kept.code = ${keptCode}
  `.execute(executor)
}

function chooseTrimmedCode(row: WorkRow): string {
  const costTrimA =
    Math.abs(row.aAreaM2 - row.overlapAreaM2 - row.aTargetM2) +
    Math.abs(row.bAreaM2 - row.bTargetM2)
  const costTrimB =
    Math.abs(row.aAreaM2 - row.aTargetM2) +
    Math.abs(row.bAreaM2 - row.overlapAreaM2 - row.bTargetM2)
  if (costTrimA === costTrimB) return row.aCode > row.bCode ? row.aCode : row.bCode
  return costTrimA < costTrimB ? row.aCode : row.bCode
}

const arguments_ = process.argv.slice(2).filter((value) => value !== '--')
if (arguments_.length !== 3) {
  throw new Error(
    'Cách dùng: pnpm db:admin-area:normalize-coverage -- <địa-giới.geojson> <diện-tích.json> <đích.geojson>',
  )
}

const [baseArgument, targetsArgument, outputArgument] = arguments_ as [string, string, string]
const baseFile = await inputPath(baseArgument)
const targetsFile = await inputPath(targetsArgument)
const destination = outputPath(outputArgument)
const [baseBytes, targetBytes] = await Promise.all([readFile(baseFile), readFile(targetsFile)])
const parsedBase = parseAdminAreaGeoJson(baseBytes)
if (parsedBase.records.some((record) => record.sourceVersion !== BASE_VERSION)) {
  throw new Error(`Gói nguồn phải dùng sourceVersion ${BASE_VERSION}.`)
}

const base = object(JSON.parse(baseBytes.toString('utf8')), 'Gói nguồn')
if (!Array.isArray(base.features) || base.features.length !== 75) {
  throw new Error('Gói nguồn phải có đúng 75 feature.')
}
const features = base.features.map((value, index) => {
  const feature = object(value, `features[${index}]`) as unknown as GeoJsonFeature
  string(feature.properties?.code, `features[${index}].properties.code`)
  return feature
})

const targetsDocument = object(JSON.parse(targetBytes.toString('utf8')), 'Bảng diện tích')
if (!Array.isArray(targetsDocument.units) || targetsDocument.units.length !== 75) {
  throw new Error('Bảng diện tích phải có đúng 75 đơn vị.')
}
const targets = new Map<string, AreaTarget>()
for (const [index, value] of targetsDocument.units.entries()) {
  const input = object(value, `units[${index}]`)
  const target = {
    code: string(input.code, `units[${index}].code`),
    name: string(input.name, `units[${index}].name`),
    targetAreaKm2: Number(input.targetAreaKm2),
  }
  if (!target.code || !target.name || !Number.isFinite(target.targetAreaKm2)) {
    throw new Error(`Diện tích mục tiêu ${index} không hợp lệ.`)
  }
  targets.set(target.code, target)
}
for (const feature of features) {
  const code = string(feature.properties.code, 'feature.properties.code')
  const target = targets.get(code)
  if (!target || target.name !== feature.properties.name) {
    throw new Error(
      `Địa bàn ${code}/${string(feature.properties.name, 'feature.properties.name')} không khớp bảng diện tích.`,
    )
  }
}

const database = createDatabase(loadConfig().databaseUrl)
try {
  const result = await database.query.transaction().execute(async (transaction) => {
    await sql`
      CREATE TEMP TABLE coverage_work (
        code text PRIMARY KEY,
        target_area_m2 double precision NOT NULL,
        geom geometry(MultiPolygon, 4326) NOT NULL
      ) ON COMMIT DROP
    `.execute(transaction)
    for (const feature of features) {
      const code = string(feature.properties.code, 'feature.properties.code')
      await insertWorkGeometry(transaction, feature, targets.get(code)!)
    }
    await sql`CREATE TEMP TABLE coverage_original ON COMMIT DROP AS TABLE coverage_work`.execute(
      transaction,
    )

    const operations: CoverageOperation[] = []
    for (let pass = 0; pass < 10; pass += 1) {
      const pairs = await listOverlapPairs(transaction)
      if (pairs.length === 0) break
      for (const pair of pairs) {
        const overlap = await readOverlap(transaction, pair.aCode, pair.bCode)
        if (!overlap) continue
        const trimmedCode = chooseTrimmedCode(overlap)
        const keptCode = trimmedCode === overlap.aCode ? overlap.bCode : overlap.aCode
        await trimOverlap(transaction, trimmedCode, keptCode)
        operations.push({ keptCode, overlapAreaM2: overlap.overlapAreaM2, trimmedCode })
      }
    }
    const remainingPairs = await listOverlapPairs(transaction)
    if (remainingPairs.length > 0) {
      const first = remainingPairs[0]!
      const remaining = await readOverlap(transaction, first.aCode, first.bCode)
      throw new Error(
        `Vẫn còn ${remainingPairs.length} phần giao; lớn nhất ${first.aCode}/${first.bCode} = ${remaining?.overlapAreaM2 ?? 'không rõ'} m².`,
      )
    }

    const verification = await sql<{
      allValid: boolean
      unionPreserved: boolean
      unionDeltaM2: number
    }>`
      WITH unions AS (
        SELECT
          (SELECT ST_UnaryUnion(ST_Collect(geom)) FROM coverage_original) AS original_geom,
          ST_UnaryUnion(ST_Collect(geom)) AS normalized_geom,
          bool_and(ST_IsValid(geom)) AS all_valid
        FROM coverage_work
      )
      SELECT
        all_valid AS "allValid",
        ST_Equals(original_geom, normalized_geom) AS "unionPreserved",
        ST_Area(ST_SymDifference(original_geom, normalized_geom)::geography) AS "unionDeltaM2"
      FROM unions
    `.execute(transaction)
    const verificationRow = verification.rows[0]
    if (!verificationRow?.allValid || verificationRow.unionDeltaM2 > OVERLAP_TOLERANCE_M2) {
      throw new Error(
        `Bản chuẩn hóa không đạt: valid=${String(verificationRow?.allValid)}, unionEquals=${String(verificationRow?.unionPreserved)}, unionDelta=${verificationRow?.unionDeltaM2 ?? 'không rõ'} m².`,
      )
    }

    const rows = await sql<{ code: string; geometry: GeoJsonFeature['geometry'] }>`
      SELECT code, ST_AsGeoJSON(geom, 15, 0)::json AS geometry
      FROM coverage_work
      ORDER BY code
    `.execute(transaction)
    return { geometries: new Map(rows.rows.map((row) => [row.code, row.geometry])), operations }
  })

  const operationSummary = new Map<string, { areaM2: number; count: number }>()
  for (const operation of result.operations) {
    const current = operationSummary.get(operation.trimmedCode) ?? { areaM2: 0, count: 0 }
    current.areaM2 += operation.overlapAreaM2
    current.count += 1
    operationSummary.set(operation.trimmedCode, current)
  }
  const outputFeatures = features.map((feature) => {
    const code = string(feature.properties.code, 'feature.properties.code')
    const summary = operationSummary.get(code)
    const previousReason =
      typeof feature.properties.normalizationReason === 'string'
        ? feature.properties.normalizationReason
        : null
    const coverageReason = summary
      ? `Topology ${OUTPUT_VALID_FROM}: bỏ ${summary.count} phần giao (${summary.areaM2.toFixed(2)} m²) theo sai lệch diện tích mục tiêu; chi tiết trong coverageNormalization.`
      : null
    return {
      ...feature,
      properties: {
        ...feature.properties,
        normalizationReason: [previousReason, coverageReason].filter(Boolean).join(' | ') || null,
        sourceVersion: OUTPUT_VERSION,
        supersedesSourceVersion: BASE_VERSION,
        validFrom: OUTPUT_VALID_FROM,
      },
      geometry: result.geometries.get(code),
    }
  })

  const output = {
    ...base,
    provenance: {
      ...object(base.provenance, 'provenance'),
      coverageNormalizedAt: OUTPUT_VALID_FROM,
    },
    coverageNormalization: {
      algorithmVersion: ALGORITHM_VERSION,
      basePackageHash: createHash('sha256').update(baseBytes).digest('hex'),
      baseSourceVersion: BASE_VERSION,
      outputSourceVersion: OUTPUT_VERSION,
      rule: 'Xử lý phần giao trên 0,01 m², lớn nhất trước; bỏ phần giao khỏi đơn vị tạo tổng sai lệch tuyệt đối nhỏ hơn so với diện tích mục tiêu. Hòa thì bỏ khỏi mã lớn hơn. Không thay đổi hợp hình học.',
      targetPackageHash: createHash('sha256').update(targetBytes).digest('hex'),
      targetVersion: string(targetsDocument.version, 'targets.version'),
      operations: result.operations,
    },
    features: outputFeatures,
  }
  const outputBytes = Buffer.from(`${JSON.stringify(output)}\n`)
  await mkdir(dirname(destination), { recursive: true })
  await writeFile(destination, outputBytes)
  process.stdout.write(
    `Đã xử lý ${result.operations.length} phần giao; SHA-256 ${createHash('sha256').update(outputBytes).digest('hex')}.\n`,
  )
} finally {
  await database.destroy()
}
