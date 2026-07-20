import type {
  CreateWorkComponentRequest,
  UpdateWorkComponentRequest,
  UpdateWorkItemRequest,
  WorkComponent,
  WorkItem,
} from '@dove/contracts'
import { sql } from 'kysely'

import type { AppDatabase, QueryExecutor } from '../../platform/database.js'
import { isoDate, isoDateTime } from '../../platform/serialization.js'

interface ItemRow extends Omit<WorkItem, 'deletedAt' | 'periodEnd' | 'periodStart'> {
  deletedAt: Date | string | null
  periodEnd: Date | string | null
  periodStart: Date | string | null
}
interface ComponentRow extends Omit<WorkComponent, 'createdAt' | 'deletedAt' | 'updatedAt'> {
  createdAt: Date | string
  deletedAt: Date | string | null
  updatedAt: Date | string
}
const itemColumns = sql.raw(`w.id, w.inspection_case_id AS "caseId",
  w.management_zone_id AS "managementZoneId", z.name AS "managementZoneName",
  w.service_group_id AS "serviceGroupId", g.name AS "serviceGroupName",
  w.measurement_kind AS "measurementKind", w.work_type_id AS "workTypeId",
  t.code AS "workTypeCode", w.name, w.period_start AS "periodStart",
  w.period_end AS "periodEnd", w.unit, w.formula_snapshot AS "formulaSnapshot",
  w.warning_threshold AS "warningThreshold", w.status, w.version,
  w.deleted_at AS "deletedAt"`)
const componentColumns = sql.raw(`wc.id, wc.case_work_item_id AS "workItemId", wc.name,
  wc.display_order AS "displayOrder", wc.status, wc.version, wc.deleted_at AS "deletedAt",
  wc.created_at AS "createdAt", wc.updated_at AS "updatedAt"`)

const mapItem = (row: ItemRow): WorkItem => ({
  ...row,
  deletedAt: row.deletedAt ? isoDateTime(row.deletedAt) : null,
  periodEnd: row.periodEnd ? isoDate(row.periodEnd) : null,
  periodStart: row.periodStart ? isoDate(row.periodStart) : null,
})
const mapComponent = (row: ComponentRow): WorkComponent => ({
  ...row,
  createdAt: isoDateTime(row.createdAt),
  deletedAt: row.deletedAt ? isoDateTime(row.deletedAt) : null,
  updatedAt: isoDateTime(row.updatedAt),
})

export class WorkStructureRepository {
  constructor(private readonly database: AppDatabase) {}

  async getItem(executor: QueryExecutor, id: string, ownerId: string, deleted = false) {
    const result = await sql<ItemRow>`SELECT ${itemColumns} FROM case_work_item w
      JOIN inspection_case c ON c.id=w.inspection_case_id
      JOIN service_group g ON g.id=w.service_group_id JOIN work_type t ON t.id=w.work_type_id
      LEFT JOIN management_zone z ON z.id=w.management_zone_id
      WHERE w.id=${id}::uuid AND c.owner_id=${ownerId}::uuid AND c.deleted_at IS NULL
        AND (${deleted} = (w.deleted_at IS NOT NULL))`.execute(executor)
    return result.rows[0] ? mapItem(result.rows[0]) : null
  }

  async updateItem(
    executor: QueryExecutor,
    id: string,
    ownerId: string,
    version: number,
    input: UpdateWorkItemRequest,
  ) {
    const result = await sql<{ id: string }>`UPDATE case_work_item w SET
      name=CASE WHEN ${Object.hasOwn(input, 'name')} THEN ${input.name ?? ''} ELSE w.name END,
      management_zone_id=CASE WHEN ${Object.hasOwn(input, 'managementZoneId')}
        THEN ${input.managementZoneId ?? null}::uuid ELSE w.management_zone_id END,
      period_start=CASE WHEN ${Object.hasOwn(input, 'periodStart')}
        THEN ${input.periodStart ?? null}::date ELSE w.period_start END,
      period_end=CASE WHEN ${Object.hasOwn(input, 'periodEnd')}
        THEN ${input.periodEnd ?? null}::date ELSE w.period_end END,
      warning_threshold=CASE WHEN ${Object.hasOwn(input, 'warningThreshold')}
        THEN ${JSON.stringify(input.warningThreshold ?? {})}::jsonb ELSE w.warning_threshold END,
      status=CASE WHEN ${Object.hasOwn(input, 'status')}
        THEN ${input.status ?? 'draft'}::work_item_status ELSE w.status END,
      version=w.version+1
      FROM inspection_case c WHERE w.id=${id}::uuid AND w.inspection_case_id=c.id
        AND c.owner_id=${ownerId}::uuid AND c.deleted_at IS NULL AND c.status<>'locked'
        AND w.deleted_at IS NULL AND w.version=${version}
        AND (${input.managementZoneId ?? null}::uuid IS NULL OR NOT ${Object.hasOwn(input, 'managementZoneId')}
          OR EXISTS (SELECT 1 FROM management_zone z WHERE z.id=${input.managementZoneId ?? null}::uuid
            AND z.active AND z.deleted_at IS NULL)) RETURNING w.id`.execute(executor)
    return result.rows[0]?.id ?? null
  }

  async itemHasChildren(executor: QueryExecutor, id: string) {
    const result = await sql<{ found: boolean }>`SELECT EXISTS(
      SELECT 1 FROM work_component WHERE case_work_item_id=${id}::uuid AND deleted_at IS NULL
      UNION ALL SELECT 1 FROM measurement WHERE case_work_item_id=${id}::uuid AND deleted_at IS NULL
    ) AS found`.execute(executor)
    return result.rows[0]?.found ?? false
  }

  async softDeleteItem(executor: QueryExecutor, id: string, ownerId: string, version: number) {
    const result = await sql<{
      id: string
    }>`UPDATE case_work_item w SET status_before_delete=w.status,
      status='archived', deleted_at=now(), version=w.version+1 FROM inspection_case c
      WHERE w.id=${id}::uuid AND w.inspection_case_id=c.id AND c.owner_id=${ownerId}::uuid
      AND c.deleted_at IS NULL AND c.status<>'locked' AND w.deleted_at IS NULL
      AND w.version=${version} RETURNING w.id`.execute(executor)
    return result.rows[0]?.id ?? null
  }

  async restoreItem(executor: QueryExecutor, id: string, ownerId: string, version: number) {
    const result = await sql<{ id: string }>`UPDATE case_work_item w SET
      status=COALESCE(w.status_before_delete, 'draft'), status_before_delete=NULL,
      deleted_at=NULL, version=w.version+1 FROM inspection_case c, service_group g
      WHERE w.id=${id}::uuid AND w.inspection_case_id=c.id AND w.service_group_id=g.id
      AND c.owner_id=${ownerId}::uuid AND c.deleted_at IS NULL AND c.status<>'locked'
      AND g.active AND g.deleted_at IS NULL AND w.deleted_at IS NOT NULL AND w.version=${version}
      AND (w.management_zone_id IS NULL OR EXISTS (SELECT 1 FROM management_zone z
        WHERE z.id=w.management_zone_id AND z.active AND z.deleted_at IS NULL)) RETURNING w.id`.execute(
      executor,
    )
    return result.rows[0]?.id ?? null
  }

  async listComponents(workItemId: string, ownerId: string, includeDeleted: boolean) {
    const result = await sql<ComponentRow>`SELECT ${componentColumns} FROM work_component wc
      JOIN case_work_item w ON w.id=wc.case_work_item_id
      JOIN inspection_case c ON c.id=w.inspection_case_id
      WHERE wc.case_work_item_id=${workItemId}::uuid AND c.owner_id=${ownerId}::uuid
        AND c.deleted_at IS NULL AND w.deleted_at IS NULL
        AND (${includeDeleted} OR wc.deleted_at IS NULL)
      ORDER BY wc.display_order, wc.created_at, wc.id`.execute(this.database)
    return result.rows.map(mapComponent)
  }

  async getComponent(executor: QueryExecutor, id: string, ownerId: string, deleted = false) {
    const result = await sql<ComponentRow>`SELECT ${componentColumns} FROM work_component wc
      JOIN case_work_item w ON w.id=wc.case_work_item_id
      JOIN inspection_case c ON c.id=w.inspection_case_id
      WHERE wc.id=${id}::uuid AND c.owner_id=${ownerId}::uuid AND c.deleted_at IS NULL
        AND w.deleted_at IS NULL AND (${deleted} = (wc.deleted_at IS NOT NULL))`.execute(executor)
    return result.rows[0] ? mapComponent(result.rows[0]) : null
  }

  async createComponent(
    executor: QueryExecutor,
    workItemId: string,
    ownerId: string,
    input: CreateWorkComponentRequest,
  ) {
    const result = await sql<{ id: string }>`INSERT INTO work_component
      (case_work_item_id, name, display_order, created_by)
      SELECT w.id, ${input.name}, ${input.displayOrder ?? 0}, ${ownerId}::uuid
      FROM case_work_item w JOIN inspection_case c ON c.id=w.inspection_case_id
      WHERE w.id=${workItemId}::uuid AND c.owner_id=${ownerId}::uuid
        AND c.deleted_at IS NULL AND c.status<>'locked' AND w.deleted_at IS NULL
      RETURNING id`.execute(executor)
    return result.rows[0]?.id ?? null
  }

  async updateComponent(
    executor: QueryExecutor,
    id: string,
    ownerId: string,
    version: number,
    input: UpdateWorkComponentRequest,
  ) {
    const result = await sql<{ id: string }>`UPDATE work_component wc SET
      name=CASE WHEN ${Object.hasOwn(input, 'name')} THEN ${input.name ?? ''} ELSE wc.name END,
      display_order=CASE WHEN ${Object.hasOwn(input, 'displayOrder')}
        THEN ${input.displayOrder ?? 0} ELSE wc.display_order END,
      status=CASE WHEN ${Object.hasOwn(input, 'status')}
        THEN ${input.status ?? 'draft'}::work_item_status ELSE wc.status END,
      version=wc.version+1 FROM case_work_item w, inspection_case c
      WHERE wc.id=${id}::uuid AND wc.case_work_item_id=w.id AND w.inspection_case_id=c.id
      AND c.owner_id=${ownerId}::uuid AND c.deleted_at IS NULL AND c.status<>'locked'
      AND w.deleted_at IS NULL AND wc.deleted_at IS NULL AND wc.version=${version}
      RETURNING wc.id`.execute(executor)
    return result.rows[0]?.id ?? null
  }

  async componentHasMeasurements(executor: QueryExecutor, id: string) {
    const result = await sql<{ found: boolean }>`SELECT EXISTS(SELECT 1 FROM measurement
      WHERE work_component_id=${id}::uuid AND deleted_at IS NULL) AS found`.execute(executor)
    return result.rows[0]?.found ?? false
  }

  async setComponentDeleted(
    executor: QueryExecutor,
    id: string,
    ownerId: string,
    version: number,
    restore: boolean,
  ) {
    const result = await sql<{ id: string }>`UPDATE work_component wc SET
      status=CASE WHEN ${restore} THEN COALESCE(wc.status_before_delete, 'draft') ELSE 'archived' END,
      status_before_delete=CASE WHEN ${restore} THEN NULL ELSE wc.status END,
      deleted_at=CASE WHEN ${restore} THEN NULL ELSE now() END, version=wc.version+1
      FROM case_work_item w, inspection_case c WHERE wc.id=${id}::uuid
      AND wc.case_work_item_id=w.id AND w.inspection_case_id=c.id AND c.owner_id=${ownerId}::uuid
      AND c.deleted_at IS NULL AND c.status<>'locked' AND w.deleted_at IS NULL
      AND wc.version=${version} AND (${restore} = (wc.deleted_at IS NOT NULL)) RETURNING wc.id`.execute(
      executor,
    )
    return result.rows[0]?.id ?? null
  }
}
