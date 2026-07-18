import type {
  CaseMapContext,
  CaseStatus,
  CreateCaseRequest,
  CreateWorkItemRequest,
  InspectionCase,
  UpdateCaseRequest,
  WorkItem,
} from '@dove/contracts'
import { sql } from 'kysely'

import type { AppDatabase, QueryExecutor } from '../../platform/database.js'
import { isoDate, isoDateTime } from '../../platform/serialization.js'

interface CaseRow extends Omit<
  InspectionCase,
  'createdAt' | 'periodEnd' | 'periodStart' | 'updatedAt'
> {
  createdAt: Date | string
  periodEnd: Date | string
  periodStart: Date | string
  updatedAt: Date | string
}

interface WorkItemRow extends Omit<WorkItem, 'periodEnd' | 'periodStart'> {
  periodEnd: Date | string | null
  periodStart: Date | string | null
}

export interface CaseListFilters {
  limit: number
  search?: string
  status?: CaseStatus
}

const caseColumns = sql.raw(`
  c.id, c.case_code AS "caseCode", c.name, c.admin_area_id AS "adminAreaId",
  a.name AS "adminAreaName", c.period_start AS "periodStart", c.period_end AS "periodEnd",
  c.inspected_entity AS "inspectedEntity", c.description, c.status,
  count(w.id)::integer AS "workItemCount", c.version,
  c.created_at AS "createdAt", c.updated_at AS "updatedAt"
`)

const mapCase = (row: CaseRow): InspectionCase => ({
  ...row,
  createdAt: isoDateTime(row.createdAt),
  periodEnd: isoDate(row.periodEnd),
  periodStart: isoDate(row.periodStart),
  updatedAt: isoDateTime(row.updatedAt),
})

const mapWorkItem = (row: WorkItemRow): WorkItem => ({
  ...row,
  periodEnd: row.periodEnd ? isoDate(row.periodEnd) : null,
  periodStart: row.periodStart ? isoDate(row.periodStart) : null,
})

export class CaseRepository {
  constructor(private readonly database: AppDatabase) {}

  async list(ownerId: string, filters: CaseListFilters): Promise<InspectionCase[]> {
    const search = filters.search ? `%${filters.search}%` : null
    const result = await sql<CaseRow>`
      SELECT ${caseColumns}
      FROM inspection_case c
      JOIN admin_area a ON a.id = c.admin_area_id
      LEFT JOIN case_work_item w ON w.inspection_case_id = c.id AND w.deleted_at IS NULL
      WHERE c.owner_id = ${ownerId}::uuid AND c.deleted_at IS NULL
        AND (${filters.status ?? null}::case_status IS NULL OR c.status = ${filters.status ?? null}::case_status)
        AND (${search}::text IS NULL OR c.case_code ILIKE ${search} OR c.name ILIKE ${search})
      GROUP BY c.id, a.name
      ORDER BY c.updated_at DESC, c.id DESC
      LIMIT ${filters.limit}
    `.execute(this.database)
    return result.rows.map(mapCase)
  }

  async get(executor: QueryExecutor, id: string, ownerId: string): Promise<InspectionCase | null> {
    const result = await sql<CaseRow>`
      SELECT ${caseColumns}
      FROM inspection_case c
      JOIN admin_area a ON a.id = c.admin_area_id
      LEFT JOIN case_work_item w ON w.inspection_case_id = c.id AND w.deleted_at IS NULL
      WHERE c.id = ${id}::uuid AND c.owner_id = ${ownerId}::uuid AND c.deleted_at IS NULL
      GROUP BY c.id, a.name
    `.execute(executor)
    return result.rows[0] ? mapCase(result.rows[0]) : null
  }

  async getMapContext(id: string, ownerId: string): Promise<CaseMapContext | null> {
    const result = await sql<CaseMapContext>`
      SELECT c.id AS "caseId", ST_AsGeoJSON(c.boundary_snapshot)::json AS boundary
      FROM inspection_case c
      WHERE c.id = ${id}::uuid AND c.owner_id = ${ownerId}::uuid AND c.deleted_at IS NULL
    `.execute(this.database)
    return result.rows[0] ?? null
  }

  async create(
    executor: QueryExecutor,
    input: CreateCaseRequest,
    ownerId: string,
  ): Promise<string | null> {
    const result = await sql<{ id: string }>`
      INSERT INTO inspection_case (
        case_code, name, admin_area_id, boundary_snapshot, period_start, period_end,
        inspected_entity, description, owner_id
      )
      SELECT ${input.caseCode}, ${input.name}, a.id, a.boundary,
        ${input.periodStart}::date, ${input.periodEnd}::date,
        ${input.inspectedEntity ?? null}, ${input.description ?? null}, ${ownerId}::uuid
      FROM admin_area a
      WHERE a.id = ${input.adminAreaId}::uuid
        AND a.valid_from <= ${input.periodEnd}::date
        AND (a.valid_to IS NULL OR a.valid_to >= ${input.periodStart}::date)
      RETURNING id
    `.execute(executor)
    return result.rows[0]?.id ?? null
  }

  async update(
    executor: QueryExecutor,
    id: string,
    ownerId: string,
    expectedVersion: number,
    input: UpdateCaseRequest,
  ): Promise<boolean> {
    const result = await sql`
      UPDATE inspection_case SET
        name = CASE WHEN ${Object.hasOwn(input, 'name')} THEN ${input.name ?? ''} ELSE name END,
        period_start = CASE WHEN ${Object.hasOwn(input, 'periodStart')}
          THEN ${input.periodStart ?? null}::date ELSE period_start END,
        period_end = CASE WHEN ${Object.hasOwn(input, 'periodEnd')}
          THEN ${input.periodEnd ?? null}::date ELSE period_end END,
        inspected_entity = CASE WHEN ${Object.hasOwn(input, 'inspectedEntity')}
          THEN ${input.inspectedEntity ?? null} ELSE inspected_entity END,
        description = CASE WHEN ${Object.hasOwn(input, 'description')}
          THEN ${input.description ?? null} ELSE description END,
        status = CASE WHEN ${Object.hasOwn(input, 'status')}
          THEN ${input.status ?? 'draft'}::case_status ELSE status END,
        version = version + 1
      WHERE id = ${id}::uuid AND owner_id = ${ownerId}::uuid
        AND version = ${expectedVersion} AND deleted_at IS NULL AND status <> 'locked'
    `.execute(executor)
    return Number(result.numAffectedRows ?? 0) === 1
  }

  async softDelete(executor: QueryExecutor, id: string, ownerId: string): Promise<boolean> {
    const result = await sql`
      UPDATE inspection_case SET deleted_at = now(), version = version + 1
      WHERE id = ${id}::uuid AND owner_id = ${ownerId}::uuid
        AND deleted_at IS NULL AND status <> 'locked'
    `.execute(executor)
    return Number(result.numAffectedRows ?? 0) === 1
  }

  async listWorkItems(caseId: string, ownerId: string): Promise<WorkItem[]> {
    const result = await sql<WorkItemRow>`
      SELECT w.id, w.inspection_case_id AS "caseId", w.work_type_id AS "workTypeId",
        t.code AS "workTypeCode", w.name, w.period_start AS "periodStart",
        w.period_end AS "periodEnd", w.unit, w.formula_snapshot AS "formulaSnapshot",
        w.warning_threshold AS "warningThreshold", w.status
      FROM case_work_item w
      JOIN work_type t ON t.id = w.work_type_id
      JOIN inspection_case c ON c.id = w.inspection_case_id
      WHERE w.inspection_case_id = ${caseId}::uuid AND c.owner_id = ${ownerId}::uuid
        AND c.deleted_at IS NULL AND w.deleted_at IS NULL
      ORDER BY w.created_at, w.id
    `.execute(this.database)
    return result.rows.map(mapWorkItem)
  }

  async createWorkItem(
    executor: QueryExecutor,
    caseId: string,
    ownerId: string,
    input: CreateWorkItemRequest,
  ): Promise<string | null> {
    const result = await sql<{ id: string }>`
      INSERT INTO case_work_item (
        inspection_case_id, work_type_id, name, period_start, period_end,
        unit, formula_snapshot, warning_threshold
      )
      SELECT c.id, t.id, ${input.name}, ${input.periodStart ?? null}::date,
        ${input.periodEnd ?? null}::date, t.base_unit,
        jsonb_build_object(
          'workTypeCode', t.code,
          'calculationVersion', t.calculation_version,
          'calculationSpec', t.calculation_spec
        ), ${JSON.stringify(input.warningThreshold ?? {})}::jsonb
      FROM inspection_case c
      JOIN work_type t ON t.id = ${input.workTypeId}::uuid AND t.active = true
      WHERE c.id = ${caseId}::uuid AND c.owner_id = ${ownerId}::uuid
        AND c.deleted_at IS NULL AND c.status <> 'locked'
      RETURNING id
    `.execute(executor)
    return result.rows[0]?.id ?? null
  }

  async getWorkItem(
    executor: QueryExecutor,
    id: string,
    ownerId: string,
  ): Promise<WorkItem | null> {
    const result = await sql<WorkItemRow>`
      SELECT w.id, w.inspection_case_id AS "caseId", w.work_type_id AS "workTypeId",
        t.code AS "workTypeCode", w.name, w.period_start AS "periodStart",
        w.period_end AS "periodEnd", w.unit, w.formula_snapshot AS "formulaSnapshot",
        w.warning_threshold AS "warningThreshold", w.status
      FROM case_work_item w
      JOIN work_type t ON t.id = w.work_type_id
      JOIN inspection_case c ON c.id = w.inspection_case_id
      WHERE w.id = ${id}::uuid AND c.owner_id = ${ownerId}::uuid
        AND c.deleted_at IS NULL AND w.deleted_at IS NULL
    `.execute(executor)
    return result.rows[0] ? mapWorkItem(result.rows[0]) : null
  }
}
