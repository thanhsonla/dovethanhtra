import { sql } from 'kysely'

import type { AppDatabase, QueryExecutor } from '../../platform/database.js'
import { isoDate } from '../../platform/serialization.js'
import type { ExportCase, ExportMeasurement, ExportSource } from './export-provider.js'

interface CaseRow extends Omit<ExportCase, 'periodEnd' | 'periodStart'> {
  periodEnd: Date | string
  periodStart: Date | string
}

interface MeasurementRow extends Omit<ExportMeasurement, 'calculatedQuantity'> {
  calculatedQuantity: number | string | null
}
interface SourceRow extends Omit<
  ExportSource,
  'documentDate' | 'periodEnd' | 'periodStart' | 'quantity'
> {
  documentDate: Date | string | null
  periodEnd: Date | string | null
  periodStart: Date | string | null
  quantity: number | string
}

export class ExportRepository {
  constructor(private readonly database: AppDatabase) {}

  async dataset(caseId: string, ownerId: string) {
    const caseResult = await sql<CaseRow>`SELECT c.id,c.case_code AS "caseCode",c.name,
      a.name AS "adminAreaName",c.period_start AS "periodStart",c.period_end AS "periodEnd",c.status
      FROM inspection_case c JOIN admin_area a ON a.id=c.admin_area_id
      WHERE c.id=${caseId}::uuid AND c.owner_id=${ownerId}::uuid AND c.deleted_at IS NULL`.execute(
      this.database,
    )
    const row = caseResult.rows[0]
    if (!row) return null
    const measurements = await sql<MeasurementRow>`SELECT m.id,m.case_work_item_id AS "workItemId",
      w.name AS "workItemName",g.name AS "groupName",m.code,m.name,m.version,m.method,
      m.geometry_kind AS "geometryKind",m.calculated_quantity AS "calculatedQuantity",m.unit,m.status,
      ST_AsGeoJSON(COALESCE(m.normalized_geometry,m.raw_geometry))::json AS geometry
      FROM measurement m JOIN case_work_item w ON w.id=m.case_work_item_id
      JOIN work_type wt ON wt.id=w.work_type_id JOIN service_group g ON g.id=wt.service_group_id
      JOIN inspection_case c ON c.id=w.inspection_case_id
      WHERE c.id=${caseId}::uuid AND c.owner_id=${ownerId}::uuid AND c.deleted_at IS NULL
        AND w.deleted_at IS NULL AND m.deleted_at IS NULL
      ORDER BY g.display_order,w.created_at,m.created_at`.execute(this.database)
    const sources = await sql<SourceRow>`SELECT s.id,s.case_work_item_id AS "workItemId",
      s.source_kind AS "sourceKind",s.document_no AS "documentNo",s.document_date AS "documentDate",
      s.quantity,s.unit,s.period_start AS "periodStart",s.period_end AS "periodEnd",s.note,
      s.attachment_id AS "attachmentId" FROM source_quantity s
      JOIN case_work_item w ON w.id=s.case_work_item_id JOIN inspection_case c ON c.id=w.inspection_case_id
      WHERE c.id=${caseId}::uuid AND c.owner_id=${ownerId}::uuid AND c.deleted_at IS NULL
        AND w.deleted_at IS NULL AND s.deleted_at IS NULL ORDER BY w.created_at,s.created_at`.execute(
      this.database,
    )
    return {
      inspectionCase: {
        ...row,
        periodStart: isoDate(row.periodStart),
        periodEnd: isoDate(row.periodEnd),
      },
      measurements: measurements.rows.map((item) => ({
        ...item,
        calculatedQuantity:
          item.calculatedQuantity === null ? null : Number(item.calculatedQuantity),
      })),
      sources: sources.rows.map((item) => ({
        ...item,
        quantity: Number(item.quantity),
        documentDate: item.documentDate ? isoDate(item.documentDate) : null,
        periodStart: item.periodStart ? isoDate(item.periodStart) : null,
        periodEnd: item.periodEnd ? isoDate(item.periodEnd) : null,
      })),
    }
  }

  async record(
    executor: QueryExecutor,
    input: {
      caseId: string
      snapshotId: string
      format: 'geojson' | 'xlsx'
      fileName: string
      fileHash: string
      sizeBytes: number
      filters: Record<string, unknown>
      ownerId: string
    },
  ) {
    const result = await sql<{ id: string }>`INSERT INTO export_record
      (inspection_case_id,snapshot_id,format,file_name,file_hash,size_bytes,filters,created_by)
      VALUES (${input.caseId}::uuid,${input.snapshotId}::uuid,${input.format},${input.fileName},
        ${input.fileHash},${input.sizeBytes},${JSON.stringify(input.filters)}::jsonb,${input.ownerId}::uuid)
      RETURNING id`.execute(executor)
    return result.rows[0]!.id
  }
}
