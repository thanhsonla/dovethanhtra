import { randomUUID } from 'node:crypto'

import type {
  ConfirmMeasurementRequest,
  CreateMeasurementRequest,
  Measurement,
  SupersedeMeasurementRequest,
  GeoJsonImportRequest,
} from '@dove/contracts'
import { sql } from 'kysely'

import { AppError } from '../../platform/app-error.js'
import { decodeCursor, encodeCursor } from '../../platform/cursor.js'
import type { AppDatabase } from '../../platform/database.js'
import type { AuditRepository } from '../audit/audit-repository.js'
import { measurementAuditSummary as auditSummary } from './measurement-audit.js'
import { parseMeasurementImport } from './measurement-import.js'
import { MeasurementPreparation } from './measurement-preparation.js'
import type { MeasurementRepository } from './measurement-repository.js'

export class MeasurementService {
  private readonly preparation: MeasurementPreparation

  constructor(
    private readonly database: AppDatabase,
    private readonly repository: MeasurementRepository,
    private readonly audit: AuditRepository,
  ) {
    this.preparation = new MeasurementPreparation(repository)
  }

  async create(
    workItemId: string,
    input: CreateMeasurementRequest,
    ownerId: string,
    traceId: string,
  ) {
    return this.database.transaction().execute(async (transaction) => {
      const prepared = await this.preparation.prepare(transaction, workItemId, ownerId, input, {
        code: `M-${randomUUID().slice(0, 8).toUpperCase()}`,
        createdBy: ownerId,
        version: 1,
      })
      const id = await this.repository.insert(transaction, prepared)
      const created = await this.repository.get(transaction, id, ownerId)
      if (!created)
        throw new AppError(500, 'MEASUREMENT_CREATE_FAILED', 'Không thể đọc phép đo vừa tạo.')
      await this.audit.append(transaction, {
        action: 'created',
        actorId: ownerId,
        afterData: auditSummary(created),
        entityId: created.id,
        entityType: 'measurement',
        inspectionCaseId: prepared.caseId,
        traceId,
      })
      return created
    })
  }

  async previewImport(workItemId: string, input: GeoJsonImportRequest, ownerId: string) {
    const parsed = parseMeasurementImport(input.collection, input.nameProperty)
    const context = await this.repository.getWorkContext(this.database, workItemId, ownerId)
    if (!context) throw new AppError(404, 'WORK_ITEM_NOT_FOUND', 'Không tìm thấy công tác.')
    if (context.caseStatus === 'locked') throw new AppError(423, 'CASE_LOCKED', 'Hồ sơ đã khóa.')
    if (context.expectedKind !== parsed.geometryKind) {
      throw new AppError(
        422,
        'WORK_TYPE_GEOMETRY_MISMATCH',
        'Kiểu geometry import không khớp công tác.',
        {
          expected: context.expectedKind,
          received: parsed.geometryKind,
        },
      )
    }
    return {
      detectedSchema: parsed.detectedSchema,
      featureCount: parsed.features.length,
      geometryKind: parsed.geometryKind,
      sampleNames: parsed.features.slice(0, 10).map((feature) => feature.name),
      sizeBytes: parsed.sizeBytes,
      sourceHash: parsed.sourceHash,
    }
  }

  async commitImport(
    workItemId: string,
    input: GeoJsonImportRequest,
    ownerId: string,
    traceId: string,
  ) {
    const parsed = parseMeasurementImport(input.collection, input.nameProperty)
    if (!input.expectedHash || input.expectedHash !== parsed.sourceHash) {
      throw new AppError(
        409,
        'IMPORT_HASH_MISMATCH',
        'GeoJSON đã khác bản preview; hãy preview lại.',
      )
    }
    return this.database.transaction().execute(async (transaction) => {
      const duplicate = await sql<{ id: string }>`SELECT id FROM measurement_import_batch
        WHERE case_work_item_id=${workItemId}::uuid AND source_hash=${parsed.sourceHash}`.execute(
        transaction,
      )
      if (duplicate.rows[0])
        throw new AppError(
          409,
          'IMPORT_ALREADY_COMMITTED',
          'GeoJSON này đã được import vào công tác.',
        )
      const measurements: Measurement[] = []
      for (const feature of parsed.features) {
        const prepared = await this.preparation.prepare(
          transaction,
          workItemId,
          ownerId,
          {
            geometry: feature.geometry,
            geometryKind: parsed.geometryKind,
            method: 'import_geojson',
            name: feature.name,
          },
          { code: `M-${randomUUID().slice(0, 8).toUpperCase()}`, createdBy: ownerId, version: 1 },
        )
        const id = await this.repository.insert(transaction, prepared)
        const created = await this.repository.get(transaction, id, ownerId)
        if (!created)
          throw new AppError(500, 'IMPORT_MEASUREMENT_FAILED', 'Không thể đọc phép đo import.')
        measurements.push(created)
        await this.audit.append(transaction, {
          action: 'imported',
          actorId: ownerId,
          afterData: auditSummary(created),
          entityId: id,
          entityType: 'measurement',
          inspectionCaseId: prepared.caseId,
          traceId,
        })
      }
      const batchId = randomUUID()
      await sql`INSERT INTO measurement_import_batch (id,case_work_item_id,source_name,
        source_hash,size_bytes,feature_count,detected_schema,imported_measurement_ids,created_by)
        VALUES (${batchId}::uuid,${workItemId}::uuid,${input.sourceName},${parsed.sourceHash},
          ${parsed.sizeBytes},${parsed.features.length},${JSON.stringify(parsed.detectedSchema)}::jsonb,
          ${measurements.map((item) => item.id)}::uuid[],${ownerId}::uuid)`.execute(transaction)
      const caseId = measurements[0]!.caseId
      await this.audit.append(transaction, {
        action: 'import_committed',
        actorId: ownerId,
        afterData: {
          batchId,
          featureCount: measurements.length,
          sourceHash: parsed.sourceHash,
          sourceName: input.sourceName,
        },
        entityId: batchId,
        entityType: 'measurement_import_batch',
        inspectionCaseId: caseId,
        traceId,
      })
      return { batchId, measurements, sourceHash: parsed.sourceHash }
    })
  }

  async list(
    workItemId: string,
    ownerId: string,
    filters: { bbox?: [number, number, number, number]; cursor?: string; limit: number },
  ) {
    const context = await this.repository.getWorkContext(this.database, workItemId, ownerId)
    if (!context) throw new AppError(404, 'WORK_ITEM_NOT_FOUND', 'Không tìm thấy công tác.')
    const { cursor: rawCursor, ...baseFilters } = filters
    const cursor = decodeCursor(rawCursor)
    const [page, confirmedTotal] = await Promise.all([
      this.repository.list(workItemId, ownerId, {
        ...baseFilters,
        ...(cursor ? { cursor } : {}),
      }),
      this.repository.confirmedTotal(workItemId, ownerId),
    ])
    return {
      items: page.items,
      confirmedTotal,
      unit: context.unit,
      nextCursor: page.nextCursor ? encodeCursor(page.nextCursor) : null,
    }
  }

  async listDeleted(workItemId: string, ownerId: string) {
    const context = await this.repository.getWorkContext(this.database, workItemId, ownerId)
    if (!context) throw new AppError(404, 'WORK_ITEM_NOT_FOUND', 'Không tìm thấy công tác.')
    return this.repository.listDeleted(workItemId, ownerId)
  }

  async get(measurementId: string, ownerId: string) {
    const found = await this.repository.get(this.database, measurementId, ownerId)
    if (!found) throw new AppError(404, 'MEASUREMENT_NOT_FOUND', 'Không tìm thấy phép đo.')
    return found
  }

  async history(measurementId: string, ownerId: string) {
    return this.audit.listForEntity(measurementId, ownerId)
  }

  async validate(measurementId: string, ownerId: string, traceId: string) {
    return this.database.transaction().execute(async (transaction) => {
      const before = await this.repository.get(transaction, measurementId, ownerId)
      if (!before) throw new AppError(404, 'MEASUREMENT_NOT_FOUND', 'Không tìm thấy phép đo.')
      if (before.geometryKind === 'route') {
        throw new AppError(
          409,
          'ROUTE_USES_ROUTING_WORKFLOW',
          'Route phải được kiểm tra lại qua phân hệ định tuyến.',
        )
      }
      if (!['draft', 'needs_attention'].includes(before.status)) {
        throw new AppError(
          409,
          'MEASUREMENT_IMMUTABLE',
          'Chỉ phép đo chưa xác nhận mới được kiểm tra lại.',
        )
      }
      const prepared = await this.preparation.prepare(
        transaction,
        before.workItemId,
        ownerId,
        {
          calculationInputs: before.calculationInputs,
          geometry: before.rawGeometry,
          geometryKind: before.geometryKind,
          method: before.method === 'import_geojson' ? 'import_geojson' : 'map_draw',
          name: before.name,
          note: before.note,
        },
        { code: before.code, createdBy: ownerId, version: before.version },
        before.id,
      )
      await this.repository.updateValidation(transaction, before.id, prepared)
      const updated = await this.repository.get(transaction, before.id, ownerId)
      if (!updated)
        throw new AppError(500, 'MEASUREMENT_VALIDATE_FAILED', 'Không thể đọc kết quả kiểm tra.')
      await this.audit.append(transaction, {
        action: 'validated',
        actorId: ownerId,
        afterData: auditSummary(updated),
        beforeData: auditSummary(before),
        entityId: updated.id,
        entityType: 'measurement',
        inspectionCaseId: prepared.caseId,
        traceId,
      })
      return updated
    })
  }

  async confirm(
    measurementId: string,
    input: ConfirmMeasurementRequest,
    ownerId: string,
    traceId: string,
  ) {
    return this.database.transaction().execute(async (transaction) => {
      const before = await this.repository.get(transaction, measurementId, ownerId)
      if (!before) throw new AppError(404, 'MEASUREMENT_NOT_FOUND', 'Không tìm thấy phép đo.')
      await this.preparation.requireContext(transaction, before.workItemId, ownerId)
      if (before.warnings.some((warning) => warning.severity === 'error')) {
        throw new AppError(422, 'MEASUREMENT_HAS_ERRORS', 'Phép đo còn lỗi và chưa thể xác nhận.')
      }
      if (!(await this.repository.confirm(transaction, before.id, ownerId))) {
        throw new AppError(
          409,
          'MEASUREMENT_CONFIRM_CONFLICT',
          'Trạng thái phép đo không cho phép xác nhận.',
        )
      }
      const confirmed = await this.repository.get(transaction, before.id, ownerId)
      if (!confirmed)
        throw new AppError(500, 'MEASUREMENT_CONFIRM_FAILED', 'Không thể đọc phép đo đã xác nhận.')
      await this.audit.append(transaction, {
        action: 'confirmed',
        actorId: ownerId,
        afterData: auditSummary(confirmed),
        beforeData: auditSummary(before),
        entityId: confirmed.id,
        entityType: 'measurement',
        inspectionCaseId: confirmed.caseId,
        reason: input.reason ?? null,
        traceId,
      })
      return confirmed
    })
  }

  async supersede(
    measurementId: string,
    input: SupersedeMeasurementRequest,
    ownerId: string,
    traceId: string,
  ) {
    return this.database.transaction().execute(async (transaction) => {
      const before = await this.repository.get(transaction, measurementId, ownerId)
      if (!before) throw new AppError(404, 'MEASUREMENT_NOT_FOUND', 'Không tìm thấy phép đo.')
      if (before.status !== 'confirmed') {
        throw new AppError(
          409,
          'MEASUREMENT_NOT_CONFIRMED',
          'Chỉ phép đo đã xác nhận mới tạo phiên bản hiệu chỉnh.',
        )
      }
      const prepared = await this.preparation.prepare(
        transaction,
        before.workItemId,
        ownerId,
        input,
        {
          code: before.code,
          createdBy: ownerId,
          supersedesId: before.id,
          version: before.version + 1,
        },
        before.id,
      )
      if (!(await this.repository.markSuperseded(transaction, before.id))) {
        throw new AppError(409, 'MEASUREMENT_SUPERSEDE_CONFLICT', 'Phép đo đã thay đổi trạng thái.')
      }
      const id = await this.repository.insert(transaction, prepared)
      const created = await this.repository.get(transaction, id, ownerId)
      if (!created)
        throw new AppError(500, 'MEASUREMENT_SUPERSEDE_FAILED', 'Không thể đọc phiên bản mới.')
      await this.audit.append(transaction, {
        action: 'superseded',
        actorId: ownerId,
        afterData: auditSummary(created),
        beforeData: auditSummary(before),
        entityId: created.id,
        entityType: 'measurement',
        inspectionCaseId: prepared.caseId,
        reason: input.reason,
        traceId,
      })
      return created
    })
  }

  async remove(measurementId: string, ownerId: string, traceId: string) {
    return this.database.transaction().execute(async (transaction) => {
      const before = await this.repository.get(transaction, measurementId, ownerId)
      if (!before) throw new AppError(404, 'MEASUREMENT_NOT_FOUND', 'Không tìm thấy phép đo.')
      await this.preparation.requireContext(transaction, before.workItemId, ownerId)
      if (!(await this.repository.softDelete(transaction, before.id))) {
        throw new AppError(409, 'MEASUREMENT_DELETE_CONFLICT', 'Không thể xóa mềm phép đo này.')
      }
      await this.audit.append(transaction, {
        action: 'soft_deleted',
        actorId: ownerId,
        beforeData: auditSummary(before),
        entityId: before.id,
        entityType: 'measurement',
        inspectionCaseId: before.caseId,
        traceId,
      })
    })
  }

  async restore(measurementId: string, reason: string, ownerId: string, traceId: string) {
    return this.database.transaction().execute(async (transaction) => {
      const before = await this.repository.getDeleted(transaction, measurementId, ownerId)
      if (!before)
        throw new AppError(404, 'MEASUREMENT_NOT_FOUND', 'Không tìm thấy phép đo đã xóa.')
      await this.preparation.requireContext(transaction, before.workItemId, ownerId)
      if (!(await this.repository.restore(transaction, measurementId))) {
        throw new AppError(409, 'MEASUREMENT_RESTORE_CONFLICT', 'Không thể phục hồi phép đo này.')
      }
      const restored = await this.repository.get(transaction, measurementId, ownerId)
      if (!restored)
        throw new AppError(500, 'MEASUREMENT_RESTORE_FAILED', 'Không thể đọc phép đo phục hồi.')
      await this.audit.append(transaction, {
        action: 'restored',
        actorId: ownerId,
        beforeData: auditSummary(before),
        afterData: auditSummary(restored),
        entityId: restored.id,
        entityType: 'measurement',
        inspectionCaseId: restored.caseId,
        reason,
        traceId,
      })
      return restored
    })
  }
}
