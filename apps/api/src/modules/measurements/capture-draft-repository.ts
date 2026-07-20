import type {
  CaptureDraft,
  CaptureDraftStatus,
  CreateCaptureDraftRequest,
  GeoJsonGeometry,
  UpdateCaptureDraftRequest,
} from '@dove/contracts'
import { sql } from 'kysely'

import type { AppDatabase, QueryExecutor } from '../../platform/database.js'
import { isoDateTime } from '../../platform/serialization.js'

export interface CaptureDraftRecord extends CaptureDraft {
  classificationIdempotencyKey: string | null
  classificationPayloadHash: string | null
  createdBy: string
  payloadHash: string
}

interface DraftRow extends Omit<
  CaptureDraftRecord,
  'classifiedAt' | 'createdAt' | 'deletedAt' | 'updatedAt'
> {
  classifiedAt: Date | string | null
  createdAt: Date | string
  deletedAt: Date | string | null
  updatedAt: Date | string
}

const columns = sql.raw(`d.id, d.inspection_case_id AS "caseId", d.local_id AS "localId",
  d.device_id AS "deviceId", d.payload_hash AS "payloadHash",
  d.classification_idempotency_key AS "classificationIdempotencyKey",
  d.classification_payload_hash AS "classificationPayloadHash",
  d.geometry_kind AS "geometryKind", d.method,
  ST_AsGeoJSON(d.raw_geometry)::json AS "rawGeometry", d.metadata, d.status, d.version,
  d.classified_measurement_id AS "classifiedMeasurementId", d.created_by AS "createdBy",
  d.classified_at AS "classifiedAt", d.deleted_at AS "deletedAt",
  d.created_at AS "createdAt", d.updated_at AS "updatedAt"`)

const mapDraft = (row: DraftRow): CaptureDraftRecord => ({
  ...row,
  classifiedAt: row.classifiedAt ? isoDateTime(row.classifiedAt) : null,
  createdAt: isoDateTime(row.createdAt),
  deletedAt: row.deletedAt ? isoDateTime(row.deletedAt) : null,
  updatedAt: isoDateTime(row.updatedAt),
})

export class CaptureDraftRepository {
  constructor(private readonly database: AppDatabase) {}

  async caseStatus(executor: QueryExecutor, caseId: string, ownerId: string) {
    const result = await sql<{ status: string }>`SELECT status FROM inspection_case
      WHERE id=${caseId}::uuid AND owner_id=${ownerId}::uuid AND deleted_at IS NULL`.execute(
      executor,
    )
    return result.rows[0]?.status ?? null
  }

  async findByIdentity(
    executor: QueryExecutor,
    ownerId: string,
    deviceId: string,
    localId: string,
    idempotencyKey: string,
  ) {
    const result = await sql<DraftRow>`SELECT ${columns} FROM capture_draft d
      WHERE d.created_by=${ownerId}::uuid AND d.device_id=${deviceId}
        AND (d.local_id=${localId} OR d.idempotency_key=${idempotencyKey})
      ORDER BY (d.idempotency_key=${idempotencyKey}) DESC LIMIT 1`.execute(executor)
    return result.rows[0] ? mapDraft(result.rows[0]) : null
  }

  async list(
    caseId: string,
    ownerId: string,
    filters: { includeDeleted: boolean; limit: number; status?: CaptureDraftStatus },
  ) {
    const result = await sql<DraftRow>`SELECT ${columns} FROM capture_draft d
      JOIN inspection_case c ON c.id=d.inspection_case_id
      WHERE d.inspection_case_id=${caseId}::uuid AND c.owner_id=${ownerId}::uuid
        AND c.deleted_at IS NULL AND (${filters.includeDeleted} OR d.deleted_at IS NULL)
        AND (${filters.status ?? null}::capture_draft_status IS NULL
          OR d.status=${filters.status ?? null}::capture_draft_status)
      ORDER BY d.created_at DESC, d.id DESC LIMIT ${filters.limit}`.execute(this.database)
    return result.rows.map(mapDraft)
  }

  async get(executor: QueryExecutor, id: string, ownerId: string, forUpdate = false) {
    const lock = forUpdate ? sql.raw('FOR UPDATE OF d') : sql.raw('')
    const result = await sql<DraftRow>`SELECT ${columns} FROM capture_draft d
      JOIN inspection_case c ON c.id=d.inspection_case_id
      WHERE d.id=${id}::uuid AND c.owner_id=${ownerId}::uuid AND c.deleted_at IS NULL
      ${lock}`.execute(executor)
    return result.rows[0] ? mapDraft(result.rows[0]) : null
  }

  async create(
    executor: QueryExecutor,
    caseId: string,
    ownerId: string,
    deviceId: string,
    idempotencyKey: string,
    payloadHash: string,
    input: CreateCaptureDraftRequest,
  ) {
    const result = await sql<{ id: string }>`INSERT INTO capture_draft (
      inspection_case_id, local_id, device_id, idempotency_key, payload_hash,
      geometry_kind, method, raw_geometry, metadata, created_by
    ) SELECT c.id, ${input.localId}, ${deviceId}, ${idempotencyKey}, ${payloadHash},
      ${input.geometryKind}::measurement_kind, ${input.method ?? 'map_draw'}::measurement_method,
      ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(input.geometry)}),4326),
      ${JSON.stringify(input.metadata ?? {})}::jsonb, ${ownerId}::uuid
    FROM inspection_case c WHERE c.id=${caseId}::uuid AND c.owner_id=${ownerId}::uuid
      AND c.deleted_at IS NULL AND c.status<>'locked'
    ON CONFLICT DO NOTHING RETURNING id`.execute(executor)
    return result.rows[0]?.id ?? null
  }

  async update(
    executor: QueryExecutor,
    id: string,
    ownerId: string,
    version: number,
    input: UpdateCaptureDraftRequest,
    effectiveGeometry: GeoJsonGeometry,
  ) {
    const result = await sql<{ id: string }>`UPDATE capture_draft d SET
      geometry_kind=CASE WHEN ${Object.hasOwn(input, 'geometryKind')}
        THEN ${input.geometryKind ?? 'point'}::measurement_kind ELSE d.geometry_kind END,
      raw_geometry=CASE WHEN ${Object.hasOwn(input, 'geometry')}
        THEN ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(effectiveGeometry)}),4326)
        ELSE d.raw_geometry END,
      metadata=CASE WHEN ${Object.hasOwn(input, 'metadata')}
        THEN ${JSON.stringify(input.metadata ?? {})}::jsonb ELSE d.metadata END,
      status='unclassified', version=d.version+1
      FROM inspection_case c WHERE d.id=${id}::uuid AND d.inspection_case_id=c.id
        AND c.owner_id=${ownerId}::uuid AND c.deleted_at IS NULL AND c.status<>'locked'
        AND d.deleted_at IS NULL AND d.status IN ('unclassified','conflict')
        AND d.version=${version} RETURNING d.id`.execute(executor)
    return result.rows[0]?.id ?? null
  }

  async setDeleted(
    executor: QueryExecutor,
    id: string,
    ownerId: string,
    version: number,
    restore: boolean,
  ) {
    const result = await sql<{ id: string }>`UPDATE capture_draft d SET
      status=CASE WHEN ${restore} THEN COALESCE(d.status_before_delete,'unclassified')
        ELSE 'deleted' END,
      status_before_delete=CASE WHEN ${restore} THEN NULL ELSE d.status END,
      deleted_at=CASE WHEN ${restore} THEN NULL ELSE now() END,
      version=d.version+1 FROM inspection_case c
      WHERE d.id=${id}::uuid AND d.inspection_case_id=c.id AND c.owner_id=${ownerId}::uuid
        AND c.deleted_at IS NULL AND c.status<>'locked' AND d.version=${version}
        AND (${restore} = (d.deleted_at IS NOT NULL)) AND d.status<>'classifying'
      RETURNING d.id`.execute(executor)
    return result.rows[0]?.id ?? null
  }

  async beginClassification(
    executor: QueryExecutor,
    id: string,
    expectedVersion: number,
    key: string,
    payloadHash: string,
  ) {
    const result = await sql`UPDATE capture_draft SET status='classifying',
      classification_idempotency_key=${key}, classification_payload_hash=${payloadHash}
      WHERE id=${id}::uuid AND version=${expectedVersion} AND deleted_at IS NULL
        AND status IN ('unclassified','conflict')`.execute(executor)
    return Number(result.numAffectedRows ?? 0) === 1
  }

  async finishClassification(executor: QueryExecutor, id: string, measurementId: string) {
    const result = await sql`UPDATE capture_draft SET status='classified',
      classified_measurement_id=${measurementId}::uuid, classified_at=now(), version=version+1
      WHERE id=${id}::uuid AND status='classifying' AND deleted_at IS NULL`.execute(executor)
    return Number(result.numAffectedRows ?? 0) === 1
  }
}
