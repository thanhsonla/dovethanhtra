import { randomUUID } from 'node:crypto'

import type {
  CaptureDraft,
  CaptureDraftStatus,
  ClassifyCaptureDraftRequest,
  CreateCaptureDraftRequest,
  UpdateCaptureDraftRequest,
} from '@dove/contracts'

import { AppError } from '../../platform/app-error.js'
import type { AppDatabase } from '../../platform/database.js'
import { payloadHash } from '../../platform/payload-hash.js'
import type { AuditRepository } from '../audit/audit-repository.js'
import type { CaptureClassificationPort } from './capture-classification-port.js'
import {
  appendCaptureClassificationAudit,
  captureDraftAuditSummary as auditDraft,
} from './capture-draft-audit.js'
import type { CaptureDraftRecord, CaptureDraftRepository } from './capture-draft-repository.js'
import { validateGeoJsonInput } from './geometry-validation.js'
import { MeasurementPreparation } from './measurement-preparation.js'
import type { MeasurementRepository } from './measurement-repository.js'

function publicDraft(record: CaptureDraftRecord): CaptureDraft {
  return {
    caseId: record.caseId,
    classifiedAt: record.classifiedAt,
    classifiedMeasurementId: record.classifiedMeasurementId,
    createdAt: record.createdAt,
    deletedAt: record.deletedAt,
    deviceId: record.deviceId,
    geometryKind: record.geometryKind,
    id: record.id,
    localId: record.localId,
    metadata: record.metadata,
    method: record.method,
    rawGeometry: record.rawGeometry,
    status: record.status,
    updatedAt: record.updatedAt,
    version: record.version,
  }
}

function validateMetadata(metadata: Record<string, unknown> | undefined) {
  if (metadata && Buffer.byteLength(JSON.stringify(metadata)) > 100_000) {
    throw new AppError(413, 'DRAFT_METADATA_TOO_LARGE', 'Metadata nháp vượt giới hạn 100 KB.')
  }
}

export class CaptureDraftService {
  private readonly preparation: MeasurementPreparation

  constructor(
    private readonly database: AppDatabase,
    private readonly drafts: CaptureDraftRepository,
    private readonly measurements: MeasurementRepository,
    private readonly structures: CaptureClassificationPort,
    private readonly audit: AuditRepository,
  ) {
    this.preparation = new MeasurementPreparation(measurements)
  }

  async list(
    caseId: string,
    ownerId: string,
    filters: { includeDeleted: boolean; limit: number; status?: CaptureDraftStatus },
  ) {
    const status = await this.drafts.caseStatus(this.database, caseId, ownerId)
    if (!status) throw new AppError(404, 'CASE_NOT_FOUND', 'Không tìm thấy hồ sơ.')
    return this.drafts.list(caseId, ownerId, filters).then((items) => items.map(publicDraft))
  }

  async get(id: string, ownerId: string) {
    const found = await this.drafts.get(this.database, id, ownerId)
    if (!found) throw new AppError(404, 'CAPTURE_DRAFT_NOT_FOUND', 'Không tìm thấy nháp.')
    return publicDraft(found)
  }

  async create(
    caseId: string,
    input: CreateCaptureDraftRequest,
    ownerId: string,
    deviceId: string,
    idempotencyKey: string,
    traceId: string,
  ) {
    validateGeoJsonInput(input.geometry, input.geometryKind)
    validateMetadata(input.metadata)
    const hash = payloadHash({ caseId, input })
    return this.database.transaction().execute(async (transaction) => {
      const existing = await this.drafts.findByIdentity(
        transaction,
        ownerId,
        deviceId,
        input.localId,
        idempotencyKey,
      )
      if (existing) {
        if (existing.payloadHash !== hash) {
          throw new AppError(
            409,
            'IDEMPOTENCY_PAYLOAD_CONFLICT',
            'Khóa hoặc mã nháp cục bộ đã được dùng với dữ liệu khác.',
          )
        }
        return { draft: publicDraft(existing), idempotentReplay: true }
      }
      const status = await this.drafts.caseStatus(transaction, caseId, ownerId)
      if (!status) throw new AppError(404, 'CASE_NOT_FOUND', 'Không tìm thấy hồ sơ.')
      if (status === 'locked') {
        throw new AppError(423, 'CASE_LOCKED', 'Hồ sơ đã khóa; nháp vẫn được giữ trên thiết bị.')
      }
      const id = await this.drafts.create(
        transaction,
        caseId,
        ownerId,
        deviceId,
        idempotencyKey,
        hash,
        input,
      )
      if (!id) {
        const concurrent = await this.drafts.findByIdentity(
          transaction,
          ownerId,
          deviceId,
          input.localId,
          idempotencyKey,
        )
        if (concurrent?.payloadHash === hash) {
          return { draft: publicDraft(concurrent), idempotentReplay: true }
        }
        throw new AppError(409, 'CAPTURE_DRAFT_CREATE_CONFLICT', 'Không thể lưu nháp.')
      }
      const created = await this.drafts.get(transaction, id, ownerId)
      if (!created) throw new AppError(500, 'CAPTURE_DRAFT_CREATE_FAILED', 'Không thể đọc nháp.')
      await this.audit.append(transaction, {
        action: 'created',
        actorId: ownerId,
        afterData: auditDraft(created),
        entityId: id,
        entityType: 'capture_draft',
        inspectionCaseId: caseId,
        traceId,
      })
      return { draft: publicDraft(created), idempotentReplay: false }
    })
  }

  async update(
    id: string,
    expectedVersion: number,
    input: UpdateCaptureDraftRequest,
    ownerId: string,
    traceId: string,
  ) {
    validateMetadata(input.metadata)
    return this.database.transaction().execute(async (transaction) => {
      const before = await this.drafts.get(transaction, id, ownerId, true)
      if (!before) throw new AppError(404, 'CAPTURE_DRAFT_NOT_FOUND', 'Không tìm thấy nháp.')
      if (before.deletedAt || before.status === 'classified') {
        throw new AppError(409, 'CAPTURE_DRAFT_IMMUTABLE', 'Nháp đã phân loại hoặc lưu trữ.')
      }
      const geometry = input.geometry ?? before.rawGeometry
      const kind = input.geometryKind ?? before.geometryKind
      validateGeoJsonInput(geometry, kind)
      const updatedId = await this.drafts.update(
        transaction,
        id,
        ownerId,
        expectedVersion,
        input,
        geometry,
      )
      if (!updatedId) {
        throw new AppError(409, 'VERSION_CONFLICT', 'Nháp đã thay đổi hoặc hồ sơ đã khóa.')
      }
      const updated = await this.drafts.get(transaction, id, ownerId)
      await this.audit.append(transaction, {
        action: 'updated',
        actorId: ownerId,
        beforeData: auditDraft(before),
        afterData: auditDraft(updated!),
        entityId: id,
        entityType: 'capture_draft',
        inspectionCaseId: before.caseId,
        traceId,
      })
      return publicDraft(updated!)
    })
  }

  async setDeleted(
    id: string,
    expectedVersion: number,
    reason: string,
    ownerId: string,
    traceId: string,
    restore: boolean,
  ) {
    return this.database.transaction().execute(async (transaction) => {
      const before = await this.drafts.get(transaction, id, ownerId, true)
      if (!before || restore !== Boolean(before.deletedAt)) {
        throw new AppError(404, 'CAPTURE_DRAFT_NOT_FOUND', 'Không tìm thấy nháp phù hợp.')
      }
      if (!(await this.drafts.setDeleted(transaction, id, ownerId, expectedVersion, restore))) {
        throw new AppError(409, 'VERSION_CONFLICT', 'Nháp đã thay đổi hoặc hồ sơ đã khóa.')
      }
      const changed = await this.drafts.get(transaction, id, ownerId)
      await this.audit.append(transaction, {
        action: restore ? 'restored' : 'soft_deleted',
        actorId: ownerId,
        beforeData: auditDraft(before),
        afterData: auditDraft(changed!),
        entityId: id,
        entityType: 'capture_draft',
        inspectionCaseId: before.caseId,
        reason,
        traceId,
      })
      return publicDraft(changed!)
    })
  }

  async classify(
    id: string,
    expectedVersion: number,
    input: ClassifyCaptureDraftRequest,
    ownerId: string,
    deviceId: string,
    idempotencyKey: string,
    traceId: string,
  ) {
    this.validateClassificationSources(input)
    const hash = payloadHash({ draftId: id, input })
    try {
      return await this.database.transaction().execute(async (transaction) => {
        const draft = await this.drafts.get(transaction, id, ownerId, true)
        if (!draft) throw new AppError(404, 'CAPTURE_DRAFT_NOT_FOUND', 'Không tìm thấy nháp.')
        if (draft.deviceId !== deviceId) {
          throw new AppError(409, 'DRAFT_DEVICE_MISMATCH', 'Nháp thuộc thiết bị đồng bộ khác.')
        }
        if (draft.status === 'classified') {
          if (
            draft.classificationIdempotencyKey !== idempotencyKey ||
            draft.classificationPayloadHash !== hash ||
            !draft.classifiedMeasurementId
          ) {
            throw new AppError(409, 'CAPTURE_DRAFT_ALREADY_CLASSIFIED', 'Nháp đã được phân loại.')
          }
          const measurement = await this.measurements.get(
            transaction,
            draft.classifiedMeasurementId,
            ownerId,
          )
          if (!measurement)
            throw new AppError(409, 'CLASSIFICATION_RESULT_MISSING', 'Kết quả không còn khả dụng.')
          return { draft: publicDraft(draft), measurement, idempotentReplay: true }
        }
        if (draft.deletedAt) throw new AppError(409, 'CAPTURE_DRAFT_DELETED', 'Nháp đã lưu trữ.')
        const caseStatus = await this.drafts.caseStatus(transaction, draft.caseId, ownerId)
        if (caseStatus === 'locked') {
          throw new AppError(423, 'CASE_LOCKED', 'Hồ sơ đã khóa; nháp chưa được phân loại.')
        }
        if (
          !(await this.drafts.beginClassification(
            transaction,
            id,
            expectedVersion,
            idempotencyKey,
            hash,
          ))
        ) {
          throw new AppError(409, 'VERSION_CONFLICT', 'Nháp đã thay đổi hoặc đang được xử lý.')
        }
        const structure = await this.structures.resolve(transaction, draft.caseId, ownerId, input)
        const prepared = await this.preparation.prepare(
          transaction,
          structure.workItemId,
          ownerId,
          {
            ...(input.calculationInputs ? { calculationInputs: input.calculationInputs } : {}),
            geometry: draft.rawGeometry,
            geometryKind: draft.geometryKind,
            method: draft.method,
            name: input.measurementName,
            ...(Object.hasOwn(input, 'note') ? { note: input.note ?? null } : {}),
          },
          { code: `M-${randomUUID().slice(0, 8).toUpperCase()}`, createdBy: ownerId, version: 1 },
        )
        const measurementId = await this.measurements.insert(transaction, {
          ...prepared,
          captureDraftId: draft.id,
          ...(structure.workComponentId ? { workComponentId: structure.workComponentId } : {}),
        })
        if (!(await this.drafts.finishClassification(transaction, id, measurementId))) {
          throw new AppError(409, 'CLASSIFICATION_CONFLICT', 'Không thể hoàn tất phân loại.')
        }
        const [classified, measurement] = await Promise.all([
          this.drafts.get(transaction, id, ownerId),
          this.measurements.get(transaction, measurementId, ownerId),
        ])
        if (!classified || !measurement)
          throw new AppError(
            500,
            'CLASSIFICATION_RESULT_MISSING',
            'Không thể đọc kết quả phân loại.',
          )
        await appendCaptureClassificationAudit(
          this.audit,
          transaction,
          draft,
          classified,
          measurement,
          structure,
          ownerId,
          traceId,
        )
        return { draft: publicDraft(classified), measurement, idempotentReplay: false }
      })
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new AppError(
          409,
          'CLASSIFICATION_IDEMPOTENCY_CONFLICT',
          'Khóa phân loại đã được sử dụng.',
        )
      }
      throw error
    }
  }

  private validateClassificationSources(input: ClassifyCaptureDraftRequest) {
    if (Boolean(input.workItemId) === Boolean(input.createWorkItem)) {
      throw new AppError(
        422,
        'WORK_ITEM_SOURCE_INVALID',
        'Chọn đúng một công tác có sẵn hoặc công tác mới.',
      )
    }
    if (input.workComponentId && input.createWorkComponent) {
      throw new AppError(422, 'WORK_COMPONENT_SOURCE_INVALID', 'Chỉ chọn một nguồn mục con.')
    }
  }
}
