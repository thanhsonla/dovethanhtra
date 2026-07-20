import type {
  CreateManagementZoneRequest,
  ManagementZone,
  UpdateManagementZoneRequest,
} from '@dove/contracts'
import { sql } from 'kysely'

import type { AppDatabase, QueryExecutor } from '../../platform/database.js'
import { isoDateTime } from '../../platform/serialization.js'

interface ZoneRow extends Omit<ManagementZone, 'createdAt' | 'deletedAt' | 'updatedAt'> {
  createdAt: Date | string
  deletedAt: Date | string | null
  updatedAt: Date | string
}

const columns = sql.raw(`id, code, name, display_order AS "displayOrder", active,
  system_seed AS "systemSeed", version, deleted_at AS "deletedAt",
  created_at AS "createdAt", updated_at AS "updatedAt"`)

const mapZone = (row: ZoneRow): ManagementZone => ({
  ...row,
  createdAt: isoDateTime(row.createdAt),
  deletedAt: row.deletedAt ? isoDateTime(row.deletedAt) : null,
  updatedAt: isoDateTime(row.updatedAt),
})

export class ManagementZoneRepository {
  constructor(private readonly database: AppDatabase) {}

  async list(includeDeleted: boolean): Promise<ManagementZone[]> {
    const result = await sql<ZoneRow>`SELECT ${columns} FROM management_zone
      WHERE (${includeDeleted} OR deleted_at IS NULL)
      ORDER BY display_order, name`.execute(this.database)
    return result.rows.map(mapZone)
  }

  async get(executor: QueryExecutor, id: string, deleted = false): Promise<ManagementZone | null> {
    const result = await sql<ZoneRow>`SELECT ${columns} FROM management_zone
      WHERE id=${id}::uuid AND (${deleted} = (deleted_at IS NOT NULL))`.execute(executor)
    return result.rows[0] ? mapZone(result.rows[0]) : null
  }

  async create(executor: QueryExecutor, input: CreateManagementZoneRequest) {
    const result = await sql<ZoneRow>`INSERT INTO management_zone (code, name, display_order)
      VALUES (${input.code}, ${input.name}, ${input.displayOrder})
      RETURNING ${columns}`.execute(executor)
    return mapZone(result.rows[0]!)
  }

  async update(
    executor: QueryExecutor,
    id: string,
    version: number,
    input: UpdateManagementZoneRequest,
  ) {
    const result = await sql<ZoneRow>`UPDATE management_zone SET
      name=CASE WHEN ${Object.hasOwn(input, 'name')} THEN ${input.name ?? ''} ELSE name END,
      display_order=CASE WHEN ${Object.hasOwn(input, 'displayOrder')}
        THEN ${input.displayOrder ?? 0} ELSE display_order END,
      system_seed=false, version=version+1
      WHERE id=${id}::uuid AND version=${version} AND deleted_at IS NULL
      RETURNING ${columns}`.execute(executor)
    return result.rows[0] ? mapZone(result.rows[0]) : null
  }

  async hasActiveWorkItems(executor: QueryExecutor, id: string) {
    const result = await sql<{ found: boolean }>`SELECT EXISTS(
      SELECT 1 FROM case_work_item WHERE management_zone_id=${id}::uuid AND deleted_at IS NULL
    ) AS found`.execute(executor)
    return result.rows[0]?.found ?? false
  }

  async softDelete(executor: QueryExecutor, id: string, version: number) {
    const result = await sql<ZoneRow>`UPDATE management_zone SET active=false, deleted_at=now(),
      system_seed=false, version=version+1 WHERE id=${id}::uuid AND version=${version}
      AND deleted_at IS NULL RETURNING ${columns}`.execute(executor)
    return result.rows[0] ? mapZone(result.rows[0]) : null
  }

  async restore(executor: QueryExecutor, id: string, version: number) {
    const result = await sql<ZoneRow>`UPDATE management_zone SET active=true, deleted_at=NULL,
      system_seed=false, version=version+1 WHERE id=${id}::uuid AND version=${version}
      AND deleted_at IS NOT NULL RETURNING ${columns}`.execute(executor)
    return result.rows[0] ? mapZone(result.rows[0]) : null
  }
}
