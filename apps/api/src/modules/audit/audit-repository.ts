import type { AuditEvent } from '@dove/contracts'
import { sql } from 'kysely'

import type { AppDatabase, QueryExecutor } from '../../platform/database.js'
import { isoDateTime } from '../../platform/serialization.js'

export interface AppendAuditInput {
  action: string
  actorId: string
  afterData?: Record<string, unknown> | null
  beforeData?: Record<string, unknown> | null
  entityId: string
  entityType: string
  inspectionCaseId?: string | null
  reason?: string | null
  traceId: string
}

interface AuditRow extends Omit<AuditEvent, 'occurredAt'> {
  occurredAt: Date | string
}

export class AuditRepository {
  constructor(private readonly database: AppDatabase) {}

  async append(executor: QueryExecutor, input: AppendAuditInput): Promise<void> {
    await sql`
      INSERT INTO audit_event (
        inspection_case_id, entity_type, entity_id, action, actor_id, reason,
        before_data, after_data, trace_id
      ) VALUES (
        ${input.inspectionCaseId ?? null}::uuid,
        ${input.entityType},
        ${input.entityId}::uuid,
        ${input.action},
        ${input.actorId}::uuid,
        ${input.reason ?? null},
        ${JSON.stringify(input.beforeData ?? null)}::jsonb,
        ${JSON.stringify(input.afterData ?? null)}::jsonb,
        ${input.traceId}
      )
    `.execute(executor)
  }

  async listForCase(caseId: string, ownerId: string): Promise<AuditEvent[]> {
    const result = await sql<AuditRow>`
      SELECT
        a.id,
        a.entity_type AS "entityType",
        a.entity_id AS "entityId",
        a.action,
        a.actor_id AS "actorId",
        u.display_name AS "actorName",
        a.occurred_at AS "occurredAt",
        a.reason,
        a.trace_id AS "traceId",
        a.before_data AS "beforeData",
        a.after_data AS "afterData"
      FROM audit_event a
      JOIN app_user u ON u.id = a.actor_id
      JOIN inspection_case c ON c.id = a.inspection_case_id
      WHERE a.inspection_case_id = ${caseId}::uuid
        AND c.owner_id = ${ownerId}::uuid
      ORDER BY a.occurred_at DESC
      LIMIT 200
    `.execute(this.database)
    return result.rows.map((row) => ({ ...row, occurredAt: isoDateTime(row.occurredAt) }))
  }

  async listForEntity(entityId: string, ownerId: string): Promise<AuditEvent[]> {
    const result = await sql<AuditRow>`
      SELECT a.id, a.entity_type AS "entityType", a.entity_id AS "entityId",
        a.action, a.actor_id AS "actorId", u.display_name AS "actorName",
        a.occurred_at AS "occurredAt", a.reason, a.trace_id AS "traceId",
        a.before_data AS "beforeData", a.after_data AS "afterData"
      FROM audit_event a
      JOIN app_user u ON u.id = a.actor_id
      JOIN inspection_case c ON c.id = a.inspection_case_id
      WHERE a.entity_id=${entityId}::uuid AND c.owner_id=${ownerId}::uuid
      ORDER BY a.occurred_at DESC LIMIT 200
    `.execute(this.database)
    return result.rows.map((row) => ({ ...row, occurredAt: isoDateTime(row.occurredAt) }))
  }
}
