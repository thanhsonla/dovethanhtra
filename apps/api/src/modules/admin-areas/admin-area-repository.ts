import type { AdminArea } from '@dove/contracts'
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
}
