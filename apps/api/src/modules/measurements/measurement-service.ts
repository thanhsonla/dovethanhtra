import { randomUUID } from 'node:crypto'

import type {
  ConfirmMeasurementRequest,
  CreateMeasurementRequest,
  Measurement,
  MeasurementWarning,
  SupersedeMeasurementRequest,
} from '@dove/contracts'

import { AppError } from '../../platform/app-error.js'
import type { AppDatabase, QueryExecutor } from '../../platform/database.js'
import type { AuditRepository } from '../audit/audit-repository.js'
import { calculateMeasurement } from './calculation-engine.js'
import { validateGeoJsonInput } from './geometry-validation.js'
import type {
  PersistMeasurementInput,
  MeasurementRepository,
  WorkMeasurementContext,
} from './measurement-repository.js'

function auditSummary(measurement: Measurement): Record<string, unknown> {
  return {
    baseValue: measurement.baseValue,
    calculatedQuantity: measurement.calculatedQuantity,
    code: measurement.code,
    id: measurement.id,
    status: measurement.status,
    validationStatus: measurement.validationStatus,
    version: measurement.version,
    warningCodes: measurement.warnings.map((warning) => warning.code),
    workItemId: measurement.workItemId,
  }
}

export class MeasurementService {
  constructor(
    private readonly database: AppDatabase,
    private readonly repository: MeasurementRepository,
    private readonly audit: AuditRepository,
  ) {}

  private async requireContext(
    executor: QueryExecutor,
    workItemId: string,
    ownerId: string,
  ): Promise<WorkMeasurementContext> {
    const context = await this.repository.getWorkContext(executor, workItemId, ownerId)
    if (!context) throw new AppError(404, 'WORK_ITEM_NOT_FOUND', 'Không tìm thấy công tác.')
    if (context.caseStatus === 'locked') {
      throw new AppError(423, 'CASE_LOCKED', 'Hồ sơ đã khóa và không thể sửa phép đo.')
    }
    return context
  }

  private async prepare(
    executor: QueryExecutor,
    workItemId: string,
    ownerId: string,
    input: CreateMeasurementRequest,
    identity: { code: string; createdBy: string; supersedesId?: string; version: number },
    excludeId?: string,
  ): Promise<PersistMeasurementInput & { caseId: string }> {
    validateGeoJsonInput(input.geometry, input.geometryKind)
    if (
      Object.values(input.calculationInputs ?? {}).some(
        (value) => !Number.isFinite(value) || value < 0,
      )
    ) {
      throw new AppError(
        422,
        'CALCULATION_INPUT_INVALID',
        'Đầu vào công thức phải là số hữu hạn không âm.',
      )
    }
    const context = await this.requireContext(executor, workItemId, ownerId)
    if (context.expectedKind !== input.geometryKind) {
      throw new AppError(
        422,
        'WORK_TYPE_GEOMETRY_MISMATCH',
        'Kiểu đo không khớp cấu hình loại công tác.',
        { expected: context.expectedKind, received: input.geometryKind },
      )
    }
    const analysis = await this.repository.analyzeGeometry(
      executor,
      workItemId,
      input.geometry,
      input.geometryKind,
      excludeId,
    )
    const warnings: MeasurementWarning[] = []
    if (!analysis.valid) {
      warnings.push({
        code: 'GEOMETRY_INVALID',
        severity: 'error',
        message: 'Hình học không hợp lệ và chưa thể xác nhận.',
        details: { reason: analysis.validReason },
      })
    }
    if (analysis.outsideValue > 0.01) {
      warnings.push({
        code: 'OUTSIDE_CASE_BOUNDARY',
        severity: 'warning',
        message: 'Một phần hình học nằm ngoài ranh giới snapshot của hồ sơ.',
        details: {
          outsideValue: analysis.outsideValue,
          unit: input.geometryKind === 'area' ? 'm2' : input.geometryKind === 'line' ? 'm' : 'điểm',
        },
      })
    }
    if (analysis.overlapCount > 0) {
      warnings.push({
        code: 'OVERLAP_DETECTED',
        severity: 'warning',
        message: 'Hình học chồng lặp với phép đo hiện hành trong cùng công tác.',
        details: { count: analysis.overlapCount },
      })
    }

    const calculation = calculateMeasurement(
      analysis.baseValue,
      input.geometryKind,
      input.calculationInputs ?? {},
      context.formulaSnapshot,
    )
    warnings.push(...calculation.warnings)
    const hasError = warnings.some((warning) => warning.severity === 'error')
    const validationStatus = hasError
      ? 'invalid'
      : warnings.length > 0
        ? 'needs_attention'
        : 'valid'

    return {
      baseValue: analysis.baseValue,
      calculatedQuantity: calculation.quantity,
      calculationInputs: input.calculationInputs ?? {},
      calculationOutput: {
        baseValue: analysis.baseValue,
        expression: calculation.expression,
        quantity: calculation.quantity,
      },
      calculationRuleCode: calculation.ruleCode,
      calculationVersion: calculation.calculationVersion,
      caseId: context.caseId,
      code: identity.code,
      createdBy: identity.createdBy,
      geometryKind: input.geometryKind,
      method: input.method ?? 'map_draw',
      name: input.name,
      normalizedGeometry: analysis.normalizedGeometry,
      note: input.note ?? null,
      rawGeometry: input.geometry,
      status: warnings.length > 0 ? 'needs_attention' : 'draft',
      ...(identity.supersedesId ? { supersedesId: identity.supersedesId } : {}),
      unit: context.unit,
      validationStatus,
      version: identity.version,
      warnings,
      workItemId,
    }
  }

  async create(
    workItemId: string,
    input: CreateMeasurementRequest,
    ownerId: string,
    traceId: string,
  ) {
    return this.database.transaction().execute(async (transaction) => {
      const prepared = await this.prepare(transaction, workItemId, ownerId, input, {
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

  async list(workItemId: string, ownerId: string) {
    const context = await this.repository.getWorkContext(this.database, workItemId, ownerId)
    if (!context) throw new AppError(404, 'WORK_ITEM_NOT_FOUND', 'Không tìm thấy công tác.')
    const [items, confirmedTotal] = await Promise.all([
      this.repository.list(workItemId, ownerId),
      this.repository.confirmedTotal(workItemId, ownerId),
    ])
    return { items, confirmedTotal, unit: context.unit }
  }

  async get(measurementId: string, ownerId: string) {
    const found = await this.repository.get(this.database, measurementId, ownerId)
    if (!found) throw new AppError(404, 'MEASUREMENT_NOT_FOUND', 'Không tìm thấy phép đo.')
    return found
  }

  async validate(measurementId: string, ownerId: string, traceId: string) {
    return this.database.transaction().execute(async (transaction) => {
      const before = await this.repository.get(transaction, measurementId, ownerId)
      if (!before) throw new AppError(404, 'MEASUREMENT_NOT_FOUND', 'Không tìm thấy phép đo.')
      if (!['draft', 'needs_attention'].includes(before.status)) {
        throw new AppError(
          409,
          'MEASUREMENT_IMMUTABLE',
          'Chỉ phép đo chưa xác nhận mới được kiểm tra lại.',
        )
      }
      const prepared = await this.prepare(
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
      await this.requireContext(transaction, before.workItemId, ownerId)
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
      const prepared = await this.prepare(
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
      await this.requireContext(transaction, before.workItemId, ownerId)
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
}
