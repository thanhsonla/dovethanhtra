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

interface ServiceGroupRow extends Omit<ServiceGroup, 'createdAt' | 'updatedAt'> {
  createdAt: Date | string
  updatedAt: Date | string
}

interface WorkTypeRow extends Omit<WorkType, 'createdAt' | 'updatedAt'> {
  createdAt: Date | string
  updatedAt: Date | string
}

const mapServiceGroup = (row: ServiceGroupRow): ServiceGroup => ({
  ...row,
  createdAt: isoDateTime(row.createdAt),
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
      SELECT id, code, name, display_order AS "displayOrder", color, active,
        created_at AS "createdAt", updated_at AS "updatedAt"
      FROM service_group
      WHERE (${includeInactive} OR active = true)
      ORDER BY display_order, name
    `.execute(this.database)
    return result.rows.map(mapServiceGroup)
  }

  async createServiceGroup(
    executor: QueryExecutor,
    input: CreateServiceGroupRequest,
  ): Promise<ServiceGroup> {
    const result = await sql<ServiceGroupRow>`
      INSERT INTO service_group (code, name, display_order, color)
      VALUES (${input.code}, ${input.name}, ${input.displayOrder}, ${input.color ?? null})
      RETURNING id, code, name, display_order AS "displayOrder", color, active,
        created_at AS "createdAt", updated_at AS "updatedAt"
    `.execute(executor)
    return mapServiceGroup(result.rows[0]!)
  }

  async updateServiceGroup(
    executor: QueryExecutor,
    id: string,
    input: UpdateServiceGroupRequest,
  ): Promise<ServiceGroup | null> {
    const hasColor = Object.hasOwn(input, 'color')
    const result = await sql<ServiceGroupRow>`
      UPDATE service_group SET
        name = CASE WHEN ${Object.hasOwn(input, 'name')} THEN ${input.name ?? ''} ELSE name END,
        display_order = CASE WHEN ${Object.hasOwn(input, 'displayOrder')}
          THEN ${input.displayOrder ?? 0} ELSE display_order END,
        color = CASE WHEN ${hasColor} THEN ${input.color ?? null} ELSE color END,
        active = CASE WHEN ${Object.hasOwn(input, 'active')} THEN ${input.active ?? false} ELSE active END
      WHERE id = ${id}::uuid
      RETURNING id, code, name, display_order AS "displayOrder", color, active,
        created_at AS "createdAt", updated_at AS "updatedAt"
    `.execute(executor)
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
