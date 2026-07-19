import { createHash } from 'node:crypto'

import type { CaseSnapshot } from '@dove/contracts'
import { sql } from 'kysely'

import type { QueryExecutor } from '../../platform/database.js'
import { isoDateTime } from '../../platform/serialization.js'

interface SnapshotRow {
  id: string
  caseId: string
  snapshotType: 'lock' | 'export'
  snapshotHash: string
  createdAt: Date | string
}

export class SnapshotRepository {
  async summary(executor: QueryExecutor, caseId: string, ownerId: string) {
    const result = await sql<{ summary: Record<string, unknown> }>`
      SELECT jsonb_build_object(
        'case', jsonb_build_object('id',c.id,'code',c.case_code,'version',c.version,'status',c.status,
          'periodStart',c.period_start,'periodEnd',c.period_end,'threshold',c.warning_threshold),
        'workItems', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',w.id,'status',w.status,
          'unit',w.unit,'formula',w.formula_snapshot,'threshold',w.warning_threshold) ORDER BY w.id)
          FROM case_work_item w WHERE w.inspection_case_id=c.id AND w.deleted_at IS NULL),'[]'::jsonb),
        'measurements', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',m.id,'workItemId',m.case_work_item_id,
          'version',m.version,'status',m.status,'method',m.method,'quantity',m.calculated_quantity,
          'rule',m.calculation_rule_code,'calculationVersion',m.calculation_version) ORDER BY m.id)
          FROM measurement m JOIN case_work_item w ON w.id=m.case_work_item_id
          WHERE w.inspection_case_id=c.id AND m.deleted_at IS NULL),'[]'::jsonb),
        'sources', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',s.id,'workItemId',s.case_work_item_id,
          'kind',s.source_kind,'quantity',s.quantity,'unit',s.unit,'explanation',e.explanation,
          'explanationAttachmentId',e.attachment_id) ORDER BY s.id)
          FROM source_quantity s JOIN case_work_item w ON w.id=s.case_work_item_id
          LEFT JOIN comparison_explanation e ON e.source_quantity_id=s.id AND e.deleted_at IS NULL
          WHERE w.inspection_case_id=c.id AND s.deleted_at IS NULL),'[]'::jsonb),
        'attachments', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',a.id,'sha256',a.sha256,
          'size',a.size_bytes) ORDER BY a.id) FROM attachment a LEFT JOIN measurement m ON m.id=a.measurement_id
          JOIN case_work_item w ON w.id=COALESCE(a.case_work_item_id,m.case_work_item_id)
          WHERE w.inspection_case_id=c.id AND a.upload_status='completed' AND a.deleted_at IS NULL),'[]'::jsonb)
      ) AS summary
      FROM inspection_case c WHERE c.id=${caseId}::uuid AND c.owner_id=${ownerId}::uuid
        AND c.deleted_at IS NULL
    `.execute(executor)
    return result.rows[0]?.summary ?? null
  }

  hash(summary: Record<string, unknown>) {
    return createHash('sha256').update(JSON.stringify(summary)).digest('hex')
  }

  async create(
    executor: QueryExecutor,
    caseId: string,
    type: 'lock' | 'export',
    summary: Record<string, unknown>,
    ownerId: string,
  ): Promise<CaseSnapshot> {
    const hash = this.hash(summary)
    const result = await sql<SnapshotRow>`INSERT INTO case_snapshot
      (inspection_case_id,snapshot_type,snapshot_hash,summary,created_by)
      VALUES (${caseId}::uuid,${type},${hash},${JSON.stringify(summary)}::jsonb,${ownerId}::uuid)
      RETURNING id,inspection_case_id AS "caseId",snapshot_type AS "snapshotType",
        snapshot_hash AS "snapshotHash",created_at AS "createdAt"`.execute(executor)
    const row = result.rows[0]!
    return { ...row, createdAt: isoDateTime(row.createdAt) }
  }
}
