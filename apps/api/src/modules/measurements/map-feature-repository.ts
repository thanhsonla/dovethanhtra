import type {
  MapFeature,
  MapFeatureConfirmedTotal,
  MeasurementGeometryKind,
  MeasurementStatus,
} from '@dove/contracts'
import { sql } from 'kysely'

import type { AppDatabase } from '../../platform/database.js'
import { isoDateTime } from '../../platform/serialization.js'
import {
  mapMeasurement,
  measurementColumns,
  type MeasurementRow,
} from './measurement-repository.js'

export interface MapFeatureFilters {
  bbox?: [number, number, number, number]
  componentId?: string
  cursor?: { id: string; timestamp: string }
  geometryKind?: MeasurementGeometryKind
  limit: number
  managementZoneId?: string
  serviceGroupId?: string
  status?: MeasurementStatus
  workItemId?: string
}

interface MapFeatureRow extends MeasurementRow {
  managementZoneId: string | null
  managementZoneName: string | null
  serviceGroupId: string
  serviceGroupName: string
  workItemName: string
  workComponentName: string | null
}

interface TotalRow {
  measurementCount: number | string
  total: number | string
  unit: string
  workComponentId: string | null
  workItemId: string
}

const joins = sql.raw(`
  JOIN case_work_item w ON w.id=m.case_work_item_id
  JOIN inspection_case c ON c.id=w.inspection_case_id
  JOIN service_group g ON g.id=w.service_group_id
  LEFT JOIN management_zone z ON z.id=w.management_zone_id
  LEFT JOIN work_component wc ON wc.id=m.work_component_id
`)

function filtersSql(caseId: string, ownerId: string, filters: MapFeatureFilters) {
  const bbox = filters.bbox ?? null
  return sql`
    c.id=${caseId}::uuid AND c.owner_id=${ownerId}::uuid
    AND c.deleted_at IS NULL AND w.deleted_at IS NULL AND m.deleted_at IS NULL
    AND (${filters.managementZoneId ?? null}::uuid IS NULL
      OR w.management_zone_id=${filters.managementZoneId ?? null}::uuid)
    AND (${filters.serviceGroupId ?? null}::uuid IS NULL
      OR w.service_group_id=${filters.serviceGroupId ?? null}::uuid)
    AND (${filters.workItemId ?? null}::uuid IS NULL
      OR w.id=${filters.workItemId ?? null}::uuid)
    AND (${filters.componentId ?? null}::uuid IS NULL
      OR m.work_component_id=${filters.componentId ?? null}::uuid)
    AND (${filters.geometryKind ?? null}::measurement_kind IS NULL
      OR m.geometry_kind=${filters.geometryKind ?? null}::measurement_kind)
    AND (${filters.status ?? null}::measurement_status IS NULL
      OR m.status=${filters.status ?? null}::measurement_status)
    AND (${filters.status ?? null}::measurement_status IS NOT NULL
      OR m.status NOT IN ('superseded','deleted'))
    AND (${bbox}::double precision[] IS NULL OR ST_Intersects(
      COALESCE(m.normalized_geometry,m.raw_geometry),
      ST_MakeEnvelope(${bbox?.[0] ?? null},${bbox?.[1] ?? null},
        ${bbox?.[2] ?? null},${bbox?.[3] ?? null},4326)))
  `
}

export class MapFeatureRepository {
  constructor(private readonly database: AppDatabase) {}

  async caseExists(caseId: string, ownerId: string): Promise<boolean> {
    const result = await sql<{ found: boolean }>`SELECT EXISTS(SELECT 1 FROM inspection_case
      WHERE id=${caseId}::uuid AND owner_id=${ownerId}::uuid AND deleted_at IS NULL) AS found`.execute(
      this.database,
    )
    return result.rows[0]?.found ?? false
  }

  async list(caseId: string, ownerId: string, filters: MapFeatureFilters) {
    const where = filtersSql(caseId, ownerId, filters)
    const result = await sql<MapFeatureRow>`
      SELECT ${measurementColumns}, w.management_zone_id AS "managementZoneId",
        z.name AS "managementZoneName", w.service_group_id AS "serviceGroupId",
        g.name AS "serviceGroupName", w.name AS "workItemName",
        wc.name AS "workComponentName"
      FROM measurement m ${joins} WHERE ${where}
        AND (${filters.cursor?.timestamp ?? null}::timestamptz IS NULL OR
          (date_trunc('milliseconds',m.created_at),m.id) >
          (${filters.cursor?.timestamp ?? null}::timestamptz,${filters.cursor?.id ?? null}::uuid))
      ORDER BY date_trunc('milliseconds',m.created_at),m.id LIMIT ${filters.limit + 1}`.execute(
      this.database,
    )
    const hasMore = result.rows.length > filters.limit
    const rows = result.rows.slice(0, filters.limit)
    const last = rows.at(-1)
    return {
      items: rows.map((row): MapFeature => ({
        managementZoneId: row.managementZoneId,
        managementZoneName: row.managementZoneName,
        measurement: mapMeasurement(row),
        serviceGroupId: row.serviceGroupId,
        serviceGroupName: row.serviceGroupName,
        workComponentName: row.workComponentName,
        workItemName: row.workItemName,
      })),
      nextCursor: hasMore && last ? { id: last.id, timestamp: isoDateTime(last.createdAt) } : null,
    }
  }

  async confirmedTotals(
    caseId: string,
    ownerId: string,
    filters: MapFeatureFilters,
  ): Promise<MapFeatureConfirmedTotal[]> {
    if (filters.status && filters.status !== 'confirmed') return []
    const where = filtersSql(caseId, ownerId, { ...filters, status: 'confirmed' })
    const result = await sql<TotalRow>`SELECT w.id AS "workItemId",
      m.work_component_id AS "workComponentId",m.unit,
      count(*)::integer AS "measurementCount",
      COALESCE(sum(m.calculated_quantity),0) AS total
      FROM measurement m ${joins} WHERE ${where}
      GROUP BY w.id,m.work_component_id,m.unit ORDER BY w.id,m.work_component_id NULLS FIRST`.execute(
      this.database,
    )
    return result.rows.map((row) => ({
      measurementCount: Number(row.measurementCount),
      total: Number(row.total),
      unit: row.unit,
      workComponentId: row.workComponentId,
      workItemId: row.workItemId,
    }))
  }
}
