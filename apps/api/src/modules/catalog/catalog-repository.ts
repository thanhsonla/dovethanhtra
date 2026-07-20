import type {
  CreateServiceGroupRequest,
  CreateWorkTypeRequest,
  ServiceGroup,
  UpdateServiceGroupRequest,
  UpdateWorkTypeRequest,
  WorkType,
} from '@dove/contracts'
import { sql } from 'kysely'

import type { AppDatabase, QueryExecutor } from '../../platform/database.js'
import { isoDateTime } from '../../platform/serialization.js'

interface ServiceGroupRow extends Omit<ServiceGroup, 'createdAt' | 'deletedAt' | 'updatedAt'> {
  createdAt: Date | string
  deletedAt: Date | string | null
  updatedAt: Date | string
}

interface WorkTypeRow extends Omit<WorkType, 'createdAt' | 'updatedAt'> {
  createdAt: Date | string
  updatedAt: Date | string
}

const mapServiceGroup = (row: ServiceGroupRow): ServiceGroup => ({
  ...row,
  createdAt: isoDateTime(row.createdAt),
  deletedAt: row.deletedAt ? isoDateTime(row.deletedAt) : null,
  updatedAt: isoDateTime(row.updatedAt),
})

const mapWorkType = (row: WorkTypeRow): WorkType => ({
  ...row,
  createdAt: isoDateTime(row.createdAt),
  updatedAt: isoDateTime(row.updatedAt),
})

export class CatalogRepository {
  constructor(private readonly database: AppDatabase) {}

  async listServiceGroups(includeInactive = false): Promise<ServiceGroup[]> {
    const result = await sql<ServiceGroupRow>`
      SELECT id, code, name, display_order AS "displayOrder", color,
        quick_default AS "quickDefault", quick_label AS "quickLabel", active, version,
        deleted_at AS "deletedAt",
        created_at AS "createdAt", updated_at AS "updatedAt"
      FROM service_group
      WHERE deleted_at IS NULL AND (${includeInactive} OR active = true)
      ORDER BY display_order, name
    `.execute(this.database)
    return result.rows.map(mapServiceGroup)
  }

  async createServiceGroup(
    executor: QueryExecutor,
    input: CreateServiceGroupRequest,
  ): Promise<ServiceGroup> {
    const result = await sql<ServiceGroupRow>`
      INSERT INTO service_group (code, name, display_order, color, quick_default, quick_label)
      VALUES (${input.code}, ${input.name}, ${input.displayOrder}, ${input.color ?? null},
        ${input.quickDefault ?? false}, ${input.quickLabel ?? null})
      RETURNING id, code, name, display_order AS "displayOrder", color,
        quick_default AS "quickDefault", quick_label AS "quickLabel", active, version,
        deleted_at AS "deletedAt",
        created_at AS "createdAt", updated_at AS "updatedAt"
    `.execute(executor)
    return mapServiceGroup(result.rows[0]!)
  }

  async updateServiceGroup(
    executor: QueryExecutor,
    id: string,
    expectedVersion: number,
    input: UpdateServiceGroupRequest,
  ): Promise<ServiceGroup | null> {
    const hasColor = Object.hasOwn(input, 'color')
    const result = await sql<ServiceGroupRow>`
      UPDATE service_group SET
        name = CASE WHEN ${Object.hasOwn(input, 'name')} THEN ${input.name ?? ''} ELSE name END,
        display_order = CASE WHEN ${Object.hasOwn(input, 'displayOrder')}
          THEN ${input.displayOrder ?? 0} ELSE display_order END,
        color = CASE WHEN ${hasColor} THEN ${input.color ?? null} ELSE color END,
        quick_default = CASE WHEN ${Object.hasOwn(input, 'quickDefault')}
          THEN ${input.quickDefault ?? false} ELSE quick_default END,
        quick_label = CASE WHEN ${Object.hasOwn(input, 'quickLabel')}
          THEN ${input.quickLabel ?? null} ELSE quick_label END,
        active = CASE WHEN ${Object.hasOwn(input, 'active')} THEN ${input.active ?? false} ELSE active END,
        version = version + 1
      WHERE id = ${id}::uuid AND version = ${expectedVersion} AND deleted_at IS NULL
      RETURNING id, code, name, display_order AS "displayOrder", color,
        quick_default AS "quickDefault", quick_label AS "quickLabel", active, version,
        deleted_at AS "deletedAt",
        created_at AS "createdAt", updated_at AS "updatedAt"
    `.execute(executor)
    return result.rows[0] ? mapServiceGroup(result.rows[0]) : null
  }

  async getServiceGroup(executor: QueryExecutor, id: string, deleted = false) {
    const result = await sql<ServiceGroupRow>`SELECT id, code, name,
      display_order AS "displayOrder", color, quick_default AS "quickDefault",
      quick_label AS "quickLabel", active, version, deleted_at AS "deletedAt",
      created_at AS "createdAt", updated_at AS "updatedAt" FROM service_group
      WHERE id=${id}::uuid AND (${deleted} = (deleted_at IS NOT NULL))`.execute(executor)
    return result.rows[0] ? mapServiceGroup(result.rows[0]) : null
  }

  async hasActiveServiceChildren(executor: QueryExecutor, id: string) {
    const result = await sql<{ found: boolean }>`SELECT EXISTS(
      SELECT 1 FROM work_type WHERE service_group_id=${id}::uuid AND active
      UNION ALL SELECT 1 FROM case_work_item WHERE service_group_id=${id}::uuid AND deleted_at IS NULL
    ) AS found`.execute(executor)
    return result.rows[0]?.found ?? false
  }

  async softDeleteServiceGroup(executor: QueryExecutor, id: string, version: number) {
    const result = await sql<ServiceGroupRow>`UPDATE service_group SET active=false,
      deleted_at=now(), version=version+1 WHERE id=${id}::uuid AND version=${version}
      AND deleted_at IS NULL RETURNING id, code, name, display_order AS "displayOrder", color,
      quick_default AS "quickDefault", quick_label AS "quickLabel", active, version,
      deleted_at AS "deletedAt", created_at AS "createdAt", updated_at AS "updatedAt"`.execute(
      executor,
    )
    return result.rows[0] ? mapServiceGroup(result.rows[0]) : null
  }

  async restoreServiceGroup(executor: QueryExecutor, id: string, version: number) {
    const result = await sql<ServiceGroupRow>`UPDATE service_group SET active=true,
      deleted_at=NULL, version=version+1 WHERE id=${id}::uuid AND version=${version}
      AND deleted_at IS NOT NULL RETURNING id, code, name, display_order AS "displayOrder", color,
      quick_default AS "quickDefault", quick_label AS "quickLabel", active, version,
      deleted_at AS "deletedAt", created_at AS "createdAt", updated_at AS "updatedAt"`.execute(
      executor,
    )
    return result.rows[0] ? mapServiceGroup(result.rows[0]) : null
  }

  async listWorkTypes(includeInactive = false): Promise<WorkType[]> {
    const result = await sql<WorkTypeRow>`
      SELECT id, service_group_id AS "serviceGroupId", code, name,
        measurement_kind AS "measurementKind", base_unit AS "baseUnit",
        attribute_schema AS "attributeSchema", calculation_spec AS "calculationSpec",
        calculation_version AS "calculationVersion", active,
        created_at AS "createdAt", updated_at AS "updatedAt"
      FROM work_type
      WHERE (${includeInactive} OR active = true)
      ORDER BY code, calculation_version DESC
    `.execute(this.database)
    return result.rows.map(mapWorkType)
  }

  async createWorkType(executor: QueryExecutor, input: CreateWorkTypeRequest): Promise<WorkType> {
    const result = await sql<WorkTypeRow>`
      INSERT INTO work_type (
        service_group_id, code, name, measurement_kind, base_unit,
        attribute_schema, calculation_spec, calculation_version
      ) VALUES (
        ${input.serviceGroupId}::uuid, ${input.code}, ${input.name},
        ${input.measurementKind}::measurement_kind, ${input.baseUnit},
        ${JSON.stringify(input.attributeSchema ?? {})}::jsonb,
        ${JSON.stringify(input.calculationSpec)}::jsonb,
        ${input.calculationVersion}
      )
      RETURNING id, service_group_id AS "serviceGroupId", code, name,
        measurement_kind AS "measurementKind", base_unit AS "baseUnit",
        attribute_schema AS "attributeSchema", calculation_spec AS "calculationSpec",
        calculation_version AS "calculationVersion", active,
        created_at AS "createdAt", updated_at AS "updatedAt"
    `.execute(executor)
    return mapWorkType(result.rows[0]!)
  }

  async updateWorkType(
    executor: QueryExecutor,
    id: string,
    input: UpdateWorkTypeRequest,
  ): Promise<WorkType | null> {
    const result = await sql<WorkTypeRow>`
      UPDATE work_type SET
        name = CASE WHEN ${Object.hasOwn(input, 'name')} THEN ${input.name ?? ''} ELSE name END,
        active = CASE WHEN ${Object.hasOwn(input, 'active')} THEN ${input.active ?? false} ELSE active END
      WHERE id = ${id}::uuid
      RETURNING id, service_group_id AS "serviceGroupId", code, name,
        measurement_kind AS "measurementKind", base_unit AS "baseUnit",
        attribute_schema AS "attributeSchema", calculation_spec AS "calculationSpec",
        calculation_version AS "calculationVersion", active,
        created_at AS "createdAt", updated_at AS "updatedAt"
    `.execute(executor)
    return result.rows[0] ? mapWorkType(result.rows[0]) : null
  }
}
