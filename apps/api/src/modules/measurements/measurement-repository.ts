import type {
  GeoJsonGeometry,
  Measurement,
  MeasurementGeometryKind,
  MeasurementWarning,
} from '@dove/contracts'
import { sql } from 'kysely'

import type { AppDatabase, QueryExecutor } from '../../platform/database.js'
import { isoDateTime } from '../../platform/serialization.js'
import type { FormulaSnapshot } from './calculation-engine.js'

export interface WorkMeasurementContext {
  caseId: string
  caseStatus: string
  expectedKind: string
  formulaSnapshot: FormulaSnapshot
  unit: string
}

export interface GeometryAnalysis {
  baseValue: number | null
  normalizedGeometry: GeoJsonGeometry | null
  outsideValue: number
  overlapCount: number
  valid: boolean
  validReason: string
}

export interface PersistMeasurementInput {
  baseValue: number | null
  calculatedQuantity: number | null
  calculationInputs: Record<string, number>
  calculationOutput: Record<string, unknown>
  calculationRuleCode: string
  calculationVersion: number
  captureDraftId?: string
  code: string
  createdBy: string
  geometryKind: MeasurementGeometryKind
  gpsAccuracyM?: number | null
  method: 'map_draw' | 'import_geojson' | 'route_provider' | 'gps_point' | 'gps_track'
  name: string
  normalizedGeometry: GeoJsonGeometry | null
  note: string | null
  rawGeometry: GeoJsonGeometry
  status: 'draft' | 'needs_attention'
  supersedesId?: string
  unit: string
  validationStatus: 'valid' | 'invalid' | 'needs_attention'
  version: number
  warnings: MeasurementWarning[]
  workItemId: string
  workComponentId?: string
}

export interface MeasurementRow extends Omit<
  Measurement,
  | 'baseValue'
  | 'calculatedQuantity'
  | 'gpsAccuracyM'
  | 'confirmedAt'
  | 'createdAt'
  | 'deletedAt'
  | 'updatedAt'
> {
  baseValue: number | string | null
  calculatedQuantity: number | string | null
  gpsAccuracyM: number | string | null
  confirmedAt: Date | string | null
  createdAt: Date | string
  deletedAt: Date | string | null
  updatedAt: Date | string
}

export const measurementColumns = sql.raw(`
  m.id, c.id AS "caseId", m.case_work_item_id AS "workItemId",
  m.work_component_id AS "workComponentId", m.capture_draft_id AS "captureDraftId",
  m.code, m.name,
  m.version, m.supersedes_id AS "supersedesId", m.method,
  m.geometry_kind AS "geometryKind", ST_AsGeoJSON(m.raw_geometry)::json AS "rawGeometry",
  CASE WHEN m.normalized_geometry IS NULL THEN NULL
    ELSE ST_AsGeoJSON(m.normalized_geometry)::json END AS "normalizedGeometry",
  m.gps_accuracy_m AS "gpsAccuracyM", m.base_value AS "baseValue",
  m.calculated_quantity AS "calculatedQuantity", m.unit,
  m.calculation_rule_code AS "calculationRuleCode",
  m.calculation_version AS "calculationVersion", m.calculation_inputs AS "calculationInputs",
  m.calculation_output AS "calculationOutput", m.validation_status AS "validationStatus",
  m.warnings, m.status, m.note, m.confirmed_at AS "confirmedAt",
  m.deleted_at AS "deletedAt", m.created_at AS "createdAt", m.updated_at AS "updatedAt"
`)

export function mapMeasurement(row: MeasurementRow): Measurement {
  return {
    ...row,
    baseValue: row.baseValue === null ? null : Number(row.baseValue),
    calculatedQuantity: row.calculatedQuantity === null ? null : Number(row.calculatedQuantity),
    gpsAccuracyM: row.gpsAccuracyM === null ? null : Number(row.gpsAccuracyM),
    confirmedAt: row.confirmedAt ? isoDateTime(row.confirmedAt) : null,
    createdAt: isoDateTime(row.createdAt),
    deletedAt: row.deletedAt ? isoDateTime(row.deletedAt) : null,
    updatedAt: isoDateTime(row.updatedAt),
  }
}

export class MeasurementRepository {
  constructor(private readonly database: AppDatabase) {}

  async getWorkContext(
    executor: QueryExecutor,
    workItemId: string,
    ownerId: string,
  ): Promise<WorkMeasurementContext | null> {
    const result = await sql<WorkMeasurementContext>`
      SELECT c.id AS "caseId", c.status AS "caseStatus", w.unit,
        w.formula_snapshot AS "formulaSnapshot", t.measurement_kind AS "expectedKind"
      FROM case_work_item w
      JOIN inspection_case c ON c.id = w.inspection_case_id
      JOIN work_type t ON t.id = w.work_type_id
      WHERE w.id = ${workItemId}::uuid AND c.owner_id = ${ownerId}::uuid
        AND c.deleted_at IS NULL AND w.deleted_at IS NULL
    `.execute(executor)
    return result.rows[0] ?? null
  }

  async analyzeGeometry(
    executor: QueryExecutor,
    workItemId: string,
    geometry: GeoJsonGeometry,
    kind: MeasurementGeometryKind,
    excludeId?: string,
  ): Promise<GeometryAnalysis> {
    const result = await sql<{
      baseValue: number | string | null
      normalizedGeometry: GeoJsonGeometry | null
      outsideValue: number | string
      overlapCount: number | string
      valid: boolean
      validReason: string
    }>`
      WITH candidate AS (
        SELECT ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(geometry)}), 4326) AS geom
      ), context AS (
        SELECT c.boundary_snapshot AS boundary
        FROM case_work_item w
        JOIN inspection_case c ON c.id = w.inspection_case_id
        WHERE w.id = ${workItemId}::uuid
      )
      SELECT
        ST_IsValid(candidate.geom) AS valid,
        ST_IsValidReason(candidate.geom) AS "validReason",
        CASE WHEN ST_IsValid(candidate.geom)
          THEN ST_AsGeoJSON(ST_Force2D(candidate.geom))::json ELSE NULL END AS "normalizedGeometry",
        CASE WHEN NOT ST_IsValid(candidate.geom) THEN NULL
          WHEN ${kind} = 'line' THEN ST_Length(ST_Force2D(candidate.geom)::geography)
          WHEN ${kind} = 'area' THEN ST_Area(ST_Force2D(candidate.geom)::geography)
          WHEN ${kind} = 'point' THEN ST_NumGeometries(candidate.geom)::numeric
          ELSE NULL END AS "baseValue",
        CASE WHEN NOT ST_IsValid(candidate.geom) THEN 0
          WHEN ${kind} = 'line' THEN ST_Length(
            ST_CollectionExtract(ST_Difference(ST_Force2D(candidate.geom), context.boundary), 2)::geography
          )
          WHEN ${kind} = 'area' THEN ST_Area(
            ST_CollectionExtract(ST_Difference(ST_Force2D(candidate.geom), context.boundary), 3)::geography
          )
          WHEN ${kind} = 'point' AND NOT ST_CoveredBy(ST_Force2D(candidate.geom), context.boundary)
            THEN ST_NumGeometries(candidate.geom)::numeric
          ELSE 0 END AS "outsideValue",
        CASE WHEN NOT ST_IsValid(candidate.geom) THEN 0 ELSE (
          SELECT count(*) FROM measurement existing
          WHERE existing.case_work_item_id = ${workItemId}::uuid
            AND existing.deleted_at IS NULL
            AND existing.status NOT IN ('superseded', 'deleted')
            AND existing.normalized_geometry IS NOT NULL
            AND (${excludeId ?? null}::uuid IS NULL OR existing.id <> ${excludeId ?? null}::uuid)
            AND CASE
              WHEN ${kind} = 'line' THEN ST_Length(ST_CollectionExtract(
                ST_Intersection(existing.normalized_geometry, ST_Force2D(candidate.geom)), 2
              )::geography) > 0
              WHEN ${kind} = 'area' THEN ST_Area(ST_CollectionExtract(
                ST_Intersection(existing.normalized_geometry, ST_Force2D(candidate.geom)), 3
              )::geography) > 0
              ELSE ST_Intersects(existing.normalized_geometry, ST_Force2D(candidate.geom))
            END
        ) END AS "overlapCount"
      FROM candidate CROSS JOIN context
    `.execute(executor)
    const row = result.rows[0]
    if (!row) throw new Error('Không thể phân tích hình học.')
    return {
      ...row,
      baseValue: row.baseValue === null ? null : Number(row.baseValue),
      outsideValue: Number(row.outsideValue),
      overlapCount: Number(row.overlapCount),
    }
  }

  async insert(executor: QueryExecutor, input: PersistMeasurementInput): Promise<string> {
    const normalized = input.normalizedGeometry ? JSON.stringify(input.normalizedGeometry) : null
    const result = await sql<{ id: string }>`
      INSERT INTO measurement (
        case_work_item_id, work_component_id, capture_draft_id,
        code, name, version, supersedes_id, method, geometry_kind,
        raw_geometry, normalized_geometry, gps_accuracy_m, base_value, calculated_quantity, unit,
        calculation_rule_code, calculation_version, calculation_inputs, calculation_output,
        validation_status, warnings, status, note, created_by
      ) VALUES (
        ${input.workItemId}::uuid, ${input.workComponentId ?? null}::uuid,
        ${input.captureDraftId ?? null}::uuid, ${input.code}, ${input.name}, ${input.version},
        ${input.supersedesId ?? null}::uuid, ${input.method}::measurement_method,
        ${input.geometryKind}::measurement_kind,
        ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(input.rawGeometry)}), 4326),
        CASE WHEN ${normalized}::text IS NULL THEN NULL
          ELSE ST_SetSRID(ST_GeomFromGeoJSON(${normalized}), 4326) END,
        ${input.gpsAccuracyM ?? null}, ${input.baseValue}, ${input.calculatedQuantity}, ${input.unit},
        ${input.calculationRuleCode}, ${input.calculationVersion},
        ${JSON.stringify(input.calculationInputs)}::jsonb,
        ${JSON.stringify(input.calculationOutput)}::jsonb,
        ${input.validationStatus}, ${JSON.stringify(input.warnings)}::jsonb,
        ${input.status}::measurement_status, ${input.note}, ${input.createdBy}::uuid
      ) RETURNING id
    `.execute(executor)
    const id = result.rows[0]?.id
    if (!id) throw new Error('Không thể lưu phép đo.')
    return id
  }

  async get(
    executor: QueryExecutor,
    measurementId: string,
    ownerId: string,
  ): Promise<Measurement | null> {
    const result = await sql<MeasurementRow>`
      SELECT ${measurementColumns}
      FROM measurement m
      JOIN case_work_item w ON w.id = m.case_work_item_id
      JOIN inspection_case c ON c.id = w.inspection_case_id
      WHERE m.id = ${measurementId}::uuid AND c.owner_id = ${ownerId}::uuid
        AND c.deleted_at IS NULL AND w.deleted_at IS NULL AND m.deleted_at IS NULL
    `.execute(executor)
    return result.rows[0] ? mapMeasurement(result.rows[0]) : null
  }

  async list(
    workItemId: string,
    ownerId: string,
    filters: {
      bbox?: [number, number, number, number]
      cursor?: { id: string; timestamp: string }
      limit: number
    },
  ): Promise<{ items: Measurement[]; nextCursor: { id: string; timestamp: string } | null }> {
    const bbox = filters.bbox ?? null
    const result = await sql<MeasurementRow>`
      SELECT ${measurementColumns}
      FROM measurement m
      JOIN case_work_item w ON w.id = m.case_work_item_id
      JOIN inspection_case c ON c.id = w.inspection_case_id
      WHERE m.case_work_item_id = ${workItemId}::uuid AND c.owner_id = ${ownerId}::uuid
        AND c.deleted_at IS NULL AND w.deleted_at IS NULL AND m.deleted_at IS NULL
        AND (${bbox}::double precision[] IS NULL OR ST_Intersects(
          COALESCE(m.normalized_geometry,m.raw_geometry),
          ST_MakeEnvelope(${bbox?.[0] ?? null},${bbox?.[1] ?? null},
            ${bbox?.[2] ?? null},${bbox?.[3] ?? null},4326)))
        AND (${filters.cursor?.timestamp ?? null}::timestamptz IS NULL OR
          (date_trunc('milliseconds',m.created_at),m.id) >
            (${filters.cursor?.timestamp ?? null}::timestamptz,${filters.cursor?.id ?? null}::uuid))
      ORDER BY date_trunc('milliseconds',m.created_at), m.id
      LIMIT ${filters.limit + 1}
    `.execute(this.database)
    const hasMore = result.rows.length > filters.limit
    const rows = result.rows.slice(0, filters.limit)
    const last = rows.at(-1)
    return {
      items: rows.map(mapMeasurement),
      nextCursor: hasMore && last ? { id: last.id, timestamp: isoDateTime(last.createdAt) } : null,
    }
  }

  async listDeleted(workItemId: string, ownerId: string): Promise<Measurement[]> {
    const result = await sql<MeasurementRow>`SELECT ${measurementColumns}
      FROM measurement m JOIN case_work_item w ON w.id=m.case_work_item_id
      JOIN inspection_case c ON c.id=w.inspection_case_id
      WHERE m.case_work_item_id=${workItemId}::uuid AND c.owner_id=${ownerId}::uuid
        AND m.deleted_at IS NOT NULL AND c.deleted_at IS NULL AND w.deleted_at IS NULL
      ORDER BY m.deleted_at DESC LIMIT 200`.execute(this.database)
    return result.rows.map(mapMeasurement)
  }

  async confirmedTotal(workItemId: string, ownerId: string): Promise<number> {
    const result = await sql<{ total: number | string }>`
      SELECT COALESCE(sum(m.calculated_quantity), 0) AS total
      FROM measurement m
      JOIN case_work_item w ON w.id = m.case_work_item_id
      JOIN inspection_case c ON c.id = w.inspection_case_id
      WHERE m.case_work_item_id = ${workItemId}::uuid AND c.owner_id = ${ownerId}::uuid
        AND m.status = 'confirmed' AND m.deleted_at IS NULL
        AND c.deleted_at IS NULL AND w.deleted_at IS NULL
    `.execute(this.database)
    return Number(result.rows[0]?.total ?? 0)
  }

  async confirm(executor: QueryExecutor, id: string, actorId: string): Promise<boolean> {
    const result = await sql`
      UPDATE measurement SET status = 'confirmed', confirmed_at = now(),
        confirmed_by = ${actorId}::uuid
      WHERE id = ${id}::uuid AND status IN ('draft', 'needs_attention')
        AND validation_status <> 'invalid' AND deleted_at IS NULL
    `.execute(executor)
    return Number(result.numAffectedRows ?? 0) === 1
  }

  async markSuperseded(executor: QueryExecutor, id: string): Promise<boolean> {
    const result = await sql`
      UPDATE measurement SET status = 'superseded'
      WHERE id = ${id}::uuid AND status = 'confirmed' AND deleted_at IS NULL
    `.execute(executor)
    return Number(result.numAffectedRows ?? 0) === 1
  }

  async updateValidation(
    executor: QueryExecutor,
    id: string,
    input: Omit<
      PersistMeasurementInput,
      | 'code'
      | 'createdBy'
      | 'geometryKind'
      | 'method'
      | 'name'
      | 'note'
      | 'rawGeometry'
      | 'supersedesId'
      | 'unit'
      | 'version'
      | 'workItemId'
    >,
  ): Promise<void> {
    const normalized = input.normalizedGeometry ? JSON.stringify(input.normalizedGeometry) : null
    await sql`
      UPDATE measurement SET
        normalized_geometry = CASE WHEN ${normalized}::text IS NULL THEN NULL
          ELSE ST_SetSRID(ST_GeomFromGeoJSON(${normalized}), 4326) END,
        base_value = ${input.baseValue}, calculated_quantity = ${input.calculatedQuantity},
        calculation_rule_code = ${input.calculationRuleCode},
        calculation_version = ${input.calculationVersion},
        calculation_inputs = ${JSON.stringify(input.calculationInputs)}::jsonb,
        calculation_output = ${JSON.stringify(input.calculationOutput)}::jsonb,
        validation_status = ${input.validationStatus},
        warnings = ${JSON.stringify(input.warnings)}::jsonb,
        status = ${input.status}::measurement_status
      WHERE id = ${id}::uuid AND status IN ('draft', 'needs_attention') AND deleted_at IS NULL
    `.execute(executor)
  }

  async softDelete(executor: QueryExecutor, id: string): Promise<boolean> {
    const result = await sql`
      UPDATE measurement SET status_before_delete=status, status = 'deleted', deleted_at = now()
      WHERE id = ${id}::uuid AND deleted_at IS NULL AND status <> 'superseded'
    `.execute(executor)
    return Number(result.numAffectedRows ?? 0) === 1
  }

  async getDeleted(
    executor: QueryExecutor,
    id: string,
    ownerId: string,
  ): Promise<Measurement | null> {
    const result = await sql<MeasurementRow>`SELECT ${measurementColumns}
      FROM measurement m JOIN case_work_item w ON w.id=m.case_work_item_id
      JOIN inspection_case c ON c.id=w.inspection_case_id
      WHERE m.id=${id}::uuid AND c.owner_id=${ownerId}::uuid AND m.deleted_at IS NOT NULL
        AND c.deleted_at IS NULL AND w.deleted_at IS NULL`.execute(executor)
    return result.rows[0] ? mapMeasurement(result.rows[0]) : null
  }

  async restore(executor: QueryExecutor, id: string): Promise<boolean> {
    const result = await sql`UPDATE measurement SET status=COALESCE(status_before_delete,'draft'),
      status_before_delete=NULL,deleted_at=NULL WHERE id=${id}::uuid AND deleted_at IS NOT NULL
      AND COALESCE(status_before_delete,'draft') <> 'superseded'`.execute(executor)
    return Number(result.numAffectedRows ?? 0) === 1
  }
}
