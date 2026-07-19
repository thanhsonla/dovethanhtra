import type {
  ComparisonThreshold,
  CreateSourceQuantityRequest,
  SourceQuantity,
  SourceQuantityKind,
} from '@dove/contracts'
import { sql } from 'kysely'

import type { AppDatabase, QueryExecutor } from '../../platform/database.js'
import { isoDate, isoDateTime } from '../../platform/serialization.js'

interface SourceRow extends Omit<
  SourceQuantity,
  'createdAt' | 'documentDate' | 'periodEnd' | 'periodStart' | 'quantity'
> {
  createdAt: Date | string
  documentDate: Date | string | null
  periodEnd: Date | string | null
  periodStart: Date | string | null
  quantity: number | string
}

export interface ComparisonRow {
  workItemId: string
  workItemName: string
  groupId: string
  groupName: string
  unit: string
  sourceQuantityId: string | null
  sourceKind: SourceQuantityKind | null
  sourceQuantity: number | string | null
  sourceAttachmentId: string | null
  inspectedQuantity: number | string
  threshold: unknown
  explanation: string | null
  explanationAttachmentId: string | null
}

const sourceColumns = sql.raw(`s.id, s.case_work_item_id AS "workItemId",
  s.source_kind AS "sourceKind", s.document_no AS "documentNo",
  s.document_date AS "documentDate", s.quantity, s.unit,
  s.period_start AS "periodStart", s.period_end AS "periodEnd", s.note,
  s.attachment_id AS "attachmentId", s.created_at AS "createdAt"`)

function mapSource(row: SourceRow): SourceQuantity {
  return {
    ...row,
    quantity: Number(row.quantity),
    documentDate: row.documentDate ? isoDate(row.documentDate) : null,
    periodStart: row.periodStart ? isoDate(row.periodStart) : null,
    periodEnd: row.periodEnd ? isoDate(row.periodEnd) : null,
    createdAt: isoDateTime(row.createdAt),
  }
}

export class ComparisonRepository {
  constructor(private readonly database: AppDatabase) {}

  async createSource(
    executor: QueryExecutor,
    workItemId: string,
    ownerId: string,
    input: CreateSourceQuantityRequest,
  ): Promise<string | null> {
    const result = await sql<{ id: string }>`
      INSERT INTO source_quantity (case_work_item_id, source_kind, document_no, document_date,
        quantity, unit, period_start, period_end, note, attachment_id, created_by)
      SELECT w.id, ${input.sourceKind}::source_quantity_kind, ${input.documentNo ?? null},
        ${input.documentDate ?? null}::date, ${input.quantity}, ${input.unit},
        ${input.periodStart ?? null}::date, ${input.periodEnd ?? null}::date,
        ${input.note ?? null}, ${input.attachmentId ?? null}::uuid, ${ownerId}::uuid
      FROM case_work_item w JOIN inspection_case c ON c.id=w.inspection_case_id
      WHERE w.id=${workItemId}::uuid AND c.owner_id=${ownerId}::uuid
        AND c.deleted_at IS NULL AND w.deleted_at IS NULL AND c.status <> 'locked'
        AND w.unit=${input.unit}
        AND (${input.attachmentId ?? null}::uuid IS NULL OR EXISTS (
          SELECT 1 FROM attachment a LEFT JOIN measurement m ON m.id=a.measurement_id
          WHERE a.id=${input.attachmentId ?? null}::uuid AND a.upload_status='completed'
            AND COALESCE(a.case_work_item_id,m.case_work_item_id)=w.id AND a.deleted_at IS NULL
        ))
      RETURNING id
    `.execute(executor)
    return result.rows[0]?.id ?? null
  }

  async getSource(executor: QueryExecutor, id: string, ownerId: string) {
    const result = await sql<SourceRow>`SELECT ${sourceColumns} FROM source_quantity s
      JOIN case_work_item w ON w.id=s.case_work_item_id
      JOIN inspection_case c ON c.id=w.inspection_case_id
      WHERE s.id=${id}::uuid AND c.owner_id=${ownerId}::uuid
        AND s.deleted_at IS NULL AND w.deleted_at IS NULL AND c.deleted_at IS NULL`.execute(
      executor,
    )
    return result.rows[0] ? mapSource(result.rows[0]) : null
  }

  async caseForSource(executor: QueryExecutor, id: string, ownerId: string) {
    const result = await sql<{ id: string }>`SELECT c.id FROM source_quantity s
      JOIN case_work_item w ON w.id=s.case_work_item_id
      JOIN inspection_case c ON c.id=w.inspection_case_id
      WHERE s.id=${id}::uuid AND c.owner_id=${ownerId}::uuid`.execute(executor)
    return result.rows[0]?.id ?? null
  }

  async listComparison(caseId: string, ownerId: string): Promise<ComparisonRow[] | null> {
    const owned = await sql<{ id: string }>`SELECT id FROM inspection_case
      WHERE id=${caseId}::uuid AND owner_id=${ownerId}::uuid AND deleted_at IS NULL`.execute(
      this.database,
    )
    if (!owned.rows.length) return null
    const result = await sql<ComparisonRow>`
      WITH totals AS (
        SELECT case_work_item_id, COALESCE(sum(calculated_quantity),0) AS inspected
        FROM measurement WHERE status='confirmed' AND deleted_at IS NULL GROUP BY case_work_item_id
      )
      SELECT w.id AS "workItemId", w.name AS "workItemName", g.id AS "groupId", g.name AS "groupName",
        w.unit, s.id AS "sourceQuantityId", s.source_kind AS "sourceKind",
        s.quantity AS "sourceQuantity", s.attachment_id AS "sourceAttachmentId",
        COALESCE(t.inspected,0) AS "inspectedQuantity",
        CASE WHEN w.warning_threshold <> '{}'::jsonb THEN w.warning_threshold
          ELSE c.warning_threshold END AS threshold,
        e.explanation, e.attachment_id AS "explanationAttachmentId"
      FROM case_work_item w JOIN inspection_case c ON c.id=w.inspection_case_id
      JOIN work_type wt ON wt.id=w.work_type_id JOIN service_group g ON g.id=wt.service_group_id
      LEFT JOIN source_quantity s ON s.case_work_item_id=w.id AND s.deleted_at IS NULL
      LEFT JOIN totals t ON t.case_work_item_id=w.id
      LEFT JOIN comparison_explanation e ON e.source_quantity_id=s.id AND e.deleted_at IS NULL
      WHERE c.id=${caseId}::uuid AND c.owner_id=${ownerId}::uuid
        AND c.deleted_at IS NULL AND w.deleted_at IS NULL
      ORDER BY g.display_order, w.created_at, s.created_at
    `.execute(this.database)
    return result.rows
  }

  async setWorkThreshold(
    executor: QueryExecutor,
    workItemId: string,
    ownerId: string,
    threshold: ComparisonThreshold,
  ) {
    const result =
      await sql`UPDATE case_work_item w SET warning_threshold=${JSON.stringify(threshold)}::jsonb
      FROM inspection_case c WHERE c.id=w.inspection_case_id AND w.id=${workItemId}::uuid
      AND c.owner_id=${ownerId}::uuid AND c.status <> 'locked'
      AND c.deleted_at IS NULL AND w.deleted_at IS NULL`.execute(executor)
    return Number(result.numAffectedRows ?? 0) === 1
  }

  async setCaseThreshold(
    executor: QueryExecutor,
    caseId: string,
    ownerId: string,
    threshold: ComparisonThreshold,
  ) {
    const result =
      await sql`UPDATE inspection_case SET warning_threshold=${JSON.stringify(threshold)}::jsonb,
      version=version+1 WHERE id=${caseId}::uuid AND owner_id=${ownerId}::uuid
      AND status <> 'locked' AND deleted_at IS NULL`.execute(executor)
    return Number(result.numAffectedRows ?? 0) === 1
  }

  async saveExplanation(
    executor: QueryExecutor,
    sourceId: string,
    ownerId: string,
    explanation: string,
    attachmentId: string | null,
  ) {
    const source = await sql<{ caseId: string }>`SELECT c.id AS "caseId" FROM source_quantity s
      JOIN case_work_item w ON w.id=s.case_work_item_id JOIN inspection_case c ON c.id=w.inspection_case_id
      WHERE s.id=${sourceId}::uuid AND c.owner_id=${ownerId}::uuid AND c.status <> 'locked'
      AND s.deleted_at IS NULL AND w.deleted_at IS NULL AND c.deleted_at IS NULL
      AND (${attachmentId}::uuid IS NULL OR EXISTS (
        SELECT 1 FROM attachment a LEFT JOIN measurement m ON m.id=a.measurement_id
        WHERE a.id=${attachmentId}::uuid AND a.upload_status='completed' AND a.deleted_at IS NULL
          AND COALESCE(a.case_work_item_id,m.case_work_item_id)=w.id
      ))`.execute(executor)
    const caseId = source.rows[0]?.caseId
    if (!caseId) return null
    const updated = await sql`UPDATE comparison_explanation SET explanation=${explanation},
      attachment_id=${attachmentId}::uuid, updated_by=${ownerId}::uuid
      WHERE source_quantity_id=${sourceId}::uuid AND deleted_at IS NULL`.execute(executor)
    if (Number(updated.numAffectedRows ?? 0) === 0)
      await sql`INSERT INTO comparison_explanation (source_quantity_id, explanation, attachment_id,
        created_by, updated_by) VALUES (${sourceId}::uuid, ${explanation}, ${attachmentId}::uuid,
        ${ownerId}::uuid, ${ownerId}::uuid)`.execute(executor)
    return caseId
  }
}
