import { sql } from 'kysely'

import type { AppDatabase, QueryExecutor } from '../../platform/database.js'
import { isoDate } from '../../platform/serialization.js'
import { isoDateTime } from '../../platform/serialization.js'
import type { ExportJob } from '@dove/contracts'
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

export interface RecoverableExportJob {
  caseId: string
  filters: Record<string, unknown>
  format: 'geojson' | 'xlsx'
  id: string
  ownerId: string
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

  async enqueue(
    executor: QueryExecutor,
    input: {
      caseId: string
      snapshotId: string
      format: 'geojson' | 'xlsx'
      fileName: string
      filters: Record<string, unknown>
      ownerId: string
    },
  ) {
    const result = await sql<{ id: string }>`INSERT INTO export_record
      (inspection_case_id,snapshot_id,format,file_name,filters,created_by,status)
      VALUES (${input.caseId}::uuid,${input.snapshotId}::uuid,${input.format},${input.fileName},
        ${JSON.stringify(input.filters)}::jsonb,${input.ownerId}::uuid,'pending') RETURNING id`.execute(
      executor,
    )
    return result.rows[0]!.id
  }

  async getJob(
    id: string,
    ownerId: string,
  ): Promise<(ExportJob & { objectKey: string | null }) | null> {
    const result = await sql<{
      id: string
      caseId: string
      format: 'geojson' | 'xlsx'
      status: ExportJob['status']
      fileName: string
      fileHash: string | null
      sizeBytes: number | string | null
      errorCode: string | null
      errorMessage: string | null
      createdAt: Date | string
      completedAt: Date | string | null
      objectKey: string | null
    }>`SELECT e.id,e.inspection_case_id AS "caseId",e.format,e.status,e.file_name AS "fileName",
      e.file_hash AS "fileHash",e.size_bytes AS "sizeBytes",e.error_code AS "errorCode",
      e.error_message AS "errorMessage",e.created_at AS "createdAt",e.completed_at AS "completedAt",
      e.object_key AS "objectKey" FROM export_record e JOIN inspection_case c ON c.id=e.inspection_case_id
      WHERE e.id=${id}::uuid AND c.owner_id=${ownerId}::uuid`.execute(this.database)
    const row = result.rows[0]
    return row
      ? {
          ...row,
          sizeBytes: row.sizeBytes === null ? null : Number(row.sizeBytes),
          createdAt: isoDateTime(row.createdAt),
          completedAt: row.completedAt ? isoDateTime(row.completedAt) : null,
        }
      : null
  }

  async claim(id: string): Promise<boolean> {
    const result = await sql`UPDATE export_record SET status='processing',started_at=now()
      WHERE id=${id}::uuid AND status='pending'`.execute(this.database)
    return Number(result.numAffectedRows ?? 0) === 1
  }

  async recoverPending(limit = 20): Promise<RecoverableExportJob[]> {
    await sql`UPDATE export_record SET status='pending',started_at=NULL
      WHERE status='processing' AND started_at < now() - interval '15 minutes'`.execute(
      this.database,
    )
    const result = await sql<RecoverableExportJob>`SELECT e.id,
      e.inspection_case_id AS "caseId",e.format,e.filters,c.owner_id AS "ownerId"
      FROM export_record e JOIN inspection_case c ON c.id=e.inspection_case_id
      WHERE e.status='pending' ORDER BY e.created_at LIMIT ${limit}`.execute(this.database)
    return result.rows
  }

  async complete(
    executor: QueryExecutor,
    id: string,
    input: { fileHash: string; sizeBytes: number; objectKey: string },
  ) {
    await sql`UPDATE export_record SET status='completed',file_hash=${input.fileHash},
      size_bytes=${input.sizeBytes},object_key=${input.objectKey},completed_at=now()
      WHERE id=${id}::uuid AND status='processing'`.execute(executor)
  }

  async fail(id: string, code: string, message: string) {
    await sql`UPDATE export_record SET status='failed',error_code=${code},
      error_message=${message.slice(0, 1000)},completed_at=now()
      WHERE id=${id}::uuid AND status IN ('pending','processing')`.execute(this.database)
  }
}
