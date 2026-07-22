import type { CreateMeasurementRequest, MeasurementWarning } from '@dove/contracts'

import { AppError } from '../../platform/app-error.js'
import type { QueryExecutor } from '../../platform/database.js'
import { calculateMeasurement } from './calculation-engine.js'
import { validateGeoJsonInput } from './geometry-validation.js'
import type {
  MeasurementRepository,
  PersistMeasurementInput,
  WorkMeasurementContext,
} from './measurement-repository.js'

export class MeasurementPreparation {
  constructor(private readonly repository: MeasurementRepository) {}

  async requireContext(
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

  async prepare(
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
      status: hasError ? 'needs_attention' : identity.supersedesId ? 'confirmed' : 'draft',
      ...(identity.supersedesId ? { supersedesId: identity.supersedesId } : {}),
      unit: context.unit,
      validationStatus,
      version: identity.version,
      warnings,
      workItemId,
    }
  }
}
