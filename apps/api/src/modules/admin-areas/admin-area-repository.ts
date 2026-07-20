import type { AdminArea, AdminAreaBoundary } from '@dove/contracts'
import { sql } from 'kysely'

import type { AppDatabase } from '../../platform/database.js'
import { isoDate } from '../../platform/serialization.js'

interface AdminAreaRow extends Omit<AdminArea, 'validFrom' | 'validTo'> {
  validFrom: Date | string
  validTo: Date | string | null
}

export class AdminAreaRepository {
  constructor(private readonly database: AppDatabase) {}

  async list(): Promise<AdminArea[]> {
    const result = await sql<AdminAreaRow>`
      SELECT
        id,
        code,
        name,
        area_type AS "areaType",
        source,
        source_hash AS "sourceHash",
        source_version AS "sourceVersion",
        valid_from AS "validFrom",
        valid_to AS "validTo"
      FROM admin_area
      WHERE valid_to IS NULL OR valid_to >= CURRENT_DATE
      ORDER BY name, source_version DESC
    `.execute(this.database)
    return result.rows.map((row) => ({
      ...row,
      validFrom: isoDate(row.validFrom),
      validTo: row.validTo ? isoDate(row.validTo) : null,
    }))
  }

  async listCurrentCommuneBoundaries(): Promise<AdminAreaBoundary[]> {
    const result = await sql<AdminAreaBoundary>`
      SELECT DISTINCT ON (code)
        id, code, name, area_type AS "areaType", source_version AS "sourceVersion",
        ST_AsGeoJSON(boundary)::json AS boundary
      FROM admin_area
      WHERE area_type IN ('commune','ward')
        AND valid_from <= CURRENT_DATE
        AND (valid_to IS NULL OR valid_to >= CURRENT_DATE)
      ORDER BY code, valid_from DESC, source_version DESC
    `.execute(this.database)
    return result.rows
  }
}
