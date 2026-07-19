import type {
  CaseComparison,
  ComparisonItem,
  ComparisonThreshold,
  CreateSourceQuantityRequest,
  SaveComparisonExplanationRequest,
} from '@dove/contracts'

import { AppError } from '../../platform/app-error.js'
import type { AppDatabase } from '../../platform/database.js'
import type { AuditRepository } from '../audit/audit-repository.js'
import { aggregateComparisons, compareQuantities } from './comparison-calculations.js'
import type { ComparisonRepository } from './comparison-repository.js'

function threshold(value: unknown): ComparisonThreshold {
  if (!value || typeof value !== 'object') return {}
  const item = value as Record<string, unknown>
  return {
    ...(typeof item.absolute === 'number' && item.absolute >= 0 ? { absolute: item.absolute } : {}),
    ...(typeof item.percent === 'number' && item.percent >= 0 ? { percent: item.percent } : {}),
  }
}

export class ComparisonService {
  constructor(
    private readonly database: AppDatabase,
    private readonly repository: ComparisonRepository,
    private readonly audit: AuditRepository,
  ) {}

  async get(caseId: string, ownerId: string): Promise<CaseComparison> {
    const rows = await this.repository.listComparison(caseId, ownerId)
    if (!rows) throw new AppError(404, 'CASE_NOT_FOUND', 'Không tìm thấy hồ sơ.')
    const items: ComparisonItem[] = rows.map((row) => {
      const inspectedQuantity = Number(row.inspectedQuantity)
      const sourceQuantity = row.sourceQuantity === null ? null : Number(row.sourceQuantity)
      const configured = threshold(row.threshold)
      return {
        workItemId: row.workItemId,
        workItemName: row.workItemName,
        groupId: row.groupId,
        groupName: row.groupName,
        unit: row.unit,
        sourceQuantityId: row.sourceQuantityId,
        sourceKind: row.sourceKind,
        sourceQuantity,
        sourceAttachmentId: row.sourceAttachmentId,
        inspectedQuantity,
        ...compareQuantities(inspectedQuantity, sourceQuantity, configured),
        threshold: configured,
        explanation: row.explanation,
        explanationAttachmentId: row.explanationAttachmentId,
      }
    })
    return { caseId, items, aggregates: aggregateComparisons(items) }
  }

  async createSource(
    workItemId: string,
    input: CreateSourceQuantityRequest,
    ownerId: string,
    traceId: string,
  ) {
    return this.database.transaction().execute(async (transaction) => {
      const id = await this.repository.createSource(transaction, workItemId, ownerId, input)
      if (!id)
        throw new AppError(
          422,
          'SOURCE_QUANTITY_INVALID',
          'Công tác đã khóa, sai đơn vị, attachment không hợp lệ hoặc không có quyền.',
        )
      const created = await this.repository.getSource(transaction, id, ownerId)
      if (!created)
        throw new AppError(500, 'SOURCE_QUANTITY_CREATE_FAILED', 'Không thể đọc số liệu nguồn.')
      const caseId = await this.repository.caseForSource(transaction, id, ownerId)
      await this.audit.append(transaction, {
        action: 'created',
        actorId: ownerId,
        afterData: {
          id,
          quantity: created.quantity,
          sourceKind: created.sourceKind,
          unit: created.unit,
        },
        entityId: id,
        entityType: 'source_quantity',
        inspectionCaseId: caseId,
        traceId,
      })
      return created
    })
  }

  async setWorkThreshold(
    workItemId: string,
    input: ComparisonThreshold,
    ownerId: string,
    traceId: string,
  ) {
    return this.database.transaction().execute(async (transaction) => {
      if (!(await this.repository.setWorkThreshold(transaction, workItemId, ownerId, input)))
        throw new AppError(423, 'COMPARISON_SETTINGS_REJECTED', 'Không thể sửa ngưỡng công tác.')
      await this.audit.append(transaction, {
        action: 'comparison_threshold_updated',
        actorId: ownerId,
        afterData: input,
        entityId: workItemId,
        entityType: 'case_work_item',
        traceId,
      })
      return input
    })
  }

  async setCaseThreshold(
    caseId: string,
    input: ComparisonThreshold,
    ownerId: string,
    traceId: string,
  ) {
    return this.database.transaction().execute(async (transaction) => {
      if (!(await this.repository.setCaseThreshold(transaction, caseId, ownerId, input)))
        throw new AppError(423, 'COMPARISON_SETTINGS_REJECTED', 'Không thể sửa ngưỡng hồ sơ.')
      await this.audit.append(transaction, {
        action: 'comparison_threshold_updated',
        actorId: ownerId,
        afterData: input,
        entityId: caseId,
        entityType: 'inspection_case',
        inspectionCaseId: caseId,
        traceId,
      })
      return input
    })
  }

  async explain(
    sourceId: string,
    input: SaveComparisonExplanationRequest,
    ownerId: string,
    traceId: string,
  ) {
    return this.database.transaction().execute(async (transaction) => {
      const caseId = await this.repository.saveExplanation(
        transaction,
        sourceId,
        ownerId,
        input.explanation,
        input.attachmentId ?? null,
      )
      if (!caseId)
        throw new AppError(422, 'COMPARISON_EXPLANATION_REJECTED', 'Không thể lưu giải trình.')
      await this.audit.append(transaction, {
        action: 'explained',
        actorId: ownerId,
        afterData: { attachmentId: input.attachmentId ?? null, explanation: input.explanation },
        entityId: sourceId,
        entityType: 'source_quantity',
        inspectionCaseId: caseId,
        traceId,
      })
      return { sourceQuantityId: sourceId, ...input, attachmentId: input.attachmentId ?? null }
    })
  }
}
