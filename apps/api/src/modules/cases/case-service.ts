import type { CreateCaseRequest, CreateWorkItemRequest, UpdateCaseRequest } from '@dove/contracts'

import { AppError } from '../../platform/app-error.js'
import type { AppDatabase } from '../../platform/database.js'
import type { AuditRepository } from '../audit/audit-repository.js'
import type { SnapshotRepository } from '../exports/snapshot-repository.js'
import type { CaseListFilters, CaseRepository } from './case-repository.js'

function translateConstraint(error: unknown): never {
  const code = (error as { code?: string }).code
  const constraint = (error as { constraint?: string }).constraint
  if (code === '23505') {
    throw new AppError(409, 'CASE_CODE_EXISTS', 'Mã hồ sơ đã tồn tại.')
  }
  if (code === '23514' && constraint?.includes('dates')) {
    throw new AppError(422, 'DATE_RANGE_INVALID', 'Ngày kết thúc phải từ ngày bắt đầu trở đi.')
  }
  throw error
}

export class CaseService {
  constructor(
    private readonly database: AppDatabase,
    private readonly repository: CaseRepository,
    private readonly audit: AuditRepository,
    private readonly snapshots: SnapshotRepository,
  ) {}

  list(ownerId: string, filters: CaseListFilters) {
    return this.repository.list(ownerId, filters)
  }

  async get(id: string, ownerId: string) {
    const found = await this.repository.get(this.database, id, ownerId)
    if (!found) throw new AppError(404, 'CASE_NOT_FOUND', 'Không tìm thấy hồ sơ.')
    return found
  }

  async getMapContext(id: string, ownerId: string) {
    const found = await this.repository.getMapContext(id, ownerId)
    if (!found) throw new AppError(404, 'CASE_NOT_FOUND', 'Không tìm thấy hồ sơ.')
    return found
  }

  async create(input: CreateCaseRequest, ownerId: string, traceId: string) {
    try {
      return await this.database.transaction().execute(async (transaction) => {
        const id = await this.repository.create(transaction, input, ownerId)
        if (!id) {
          throw new AppError(
            422,
            'ADMIN_AREA_INVALID',
            'Địa bàn không tồn tại hoặc không có hiệu lực trong kỳ hồ sơ.',
          )
        }
        let copiedStructure: {
          copiedWorkItemIds: string[]
          sourceCaseId: string
          sourceWorkItemIds: string[]
        } | null = null
        if (input.copyStructure) {
          const source = await this.repository.get(
            transaction,
            input.copyStructure.sourceCaseId,
            ownerId,
          )
          if (!source) {
            throw new AppError(404, 'SOURCE_CASE_NOT_FOUND', 'Không tìm thấy hồ sơ mẫu.')
          }
          const availableWorkItemIds = await this.repository.listWorkItemIds(
            transaction,
            source.id,
            ownerId,
          )
          const sourceWorkItemIds = input.copyStructure.workItemIds ?? availableWorkItemIds
          if (sourceWorkItemIds.length > 200) {
            throw new AppError(
              422,
              'SOURCE_WORK_ITEM_LIMIT_EXCEEDED',
              'Mỗi lần chỉ được sao chép tối đa 200 công tác.',
            )
          }
          if (sourceWorkItemIds.some((id) => !availableWorkItemIds.includes(id))) {
            throw new AppError(
              422,
              'SOURCE_WORK_ITEMS_INVALID',
              'Một hoặc nhiều công tác mẫu không thuộc hồ sơ nguồn.',
            )
          }
          const copied = await this.repository.copyWorkItems(
            transaction,
            id,
            source.id,
            ownerId,
            sourceWorkItemIds,
          )
          if (copied.length !== sourceWorkItemIds.length) {
            throw new AppError(
              422,
              'SOURCE_WORK_ITEMS_INVALID',
              'Một hoặc nhiều công tác mẫu không thuộc hồ sơ nguồn.',
            )
          }
          copiedStructure = {
            copiedWorkItemIds: copied,
            sourceCaseId: source.id,
            sourceWorkItemIds,
          }
        }
        const created = await this.repository.get(transaction, id, ownerId)
        if (!created) throw new AppError(500, 'CASE_CREATE_FAILED', 'Không thể đọc hồ sơ vừa tạo.')
        await this.audit.append(transaction, {
          action: 'created',
          actorId: ownerId,
          afterData: created,
          entityId: created.id,
          entityType: 'inspection_case',
          inspectionCaseId: created.id,
          traceId,
        })
        if (copiedStructure) {
          await this.audit.append(transaction, {
            action: 'structure_copied',
            actorId: ownerId,
            afterData: {
              ...copiedStructure,
              copiedWorkItemCount: copiedStructure.copiedWorkItemIds.length,
            },
            entityId: id,
            entityType: 'inspection_case',
            inspectionCaseId: id,
            traceId,
          })
        }
        return created
      })
    } catch (error) {
      if (error instanceof AppError) throw error
      return translateConstraint(error)
    }
  }

  async update(
    id: string,
    expectedVersion: number,
    input: UpdateCaseRequest,
    ownerId: string,
    traceId: string,
  ) {
    try {
      return await this.database.transaction().execute(async (transaction) => {
        const before = await this.repository.get(transaction, id, ownerId)
        if (!before) throw new AppError(404, 'CASE_NOT_FOUND', 'Không tìm thấy hồ sơ.')
        if (before.status === 'locked') {
          throw new AppError(423, 'CASE_LOCKED', 'Hồ sơ đã khóa và không thể sửa.')
        }
        const changed = await this.repository.update(
          transaction,
          id,
          ownerId,
          expectedVersion,
          input,
        )
        if (!changed) {
          throw new AppError(
            409,
            'VERSION_CONFLICT',
            'Hồ sơ đã thay đổi. Hãy tải lại trước khi sửa.',
          )
        }
        const updated = await this.repository.get(transaction, id, ownerId)
        if (!updated) throw new AppError(500, 'CASE_UPDATE_FAILED', 'Không thể đọc hồ sơ vừa sửa.')
        await this.audit.append(transaction, {
          action: 'updated',
          actorId: ownerId,
          afterData: updated,
          beforeData: before,
          entityId: id,
          entityType: 'inspection_case',
          inspectionCaseId: id,
          traceId,
        })
        return updated
      })
    } catch (error) {
      if (error instanceof AppError) throw error
      return translateConstraint(error)
    }
  }

  async remove(id: string, ownerId: string, traceId: string) {
    return this.database.transaction().execute(async (transaction) => {
      const before = await this.repository.get(transaction, id, ownerId)
      if (!before) throw new AppError(404, 'CASE_NOT_FOUND', 'Không tìm thấy hồ sơ.')
      if (before.status === 'locked') {
        throw new AppError(423, 'CASE_LOCKED', 'Hồ sơ đã khóa và không thể xóa.')
      }
      if (!(await this.repository.softDelete(transaction, id, ownerId))) {
        throw new AppError(
          409,
          'CASE_DELETE_CONFLICT',
          'Không thể xóa mềm hồ sơ ở trạng thái hiện tại.',
        )
      }
      await this.audit.append(transaction, {
        action: 'soft_deleted',
        actorId: ownerId,
        beforeData: before,
        entityId: id,
        entityType: 'inspection_case',
        inspectionCaseId: id,
        traceId,
      })
    })
  }

  async lock(id: string, reason: string, ownerId: string, traceId: string) {
    return this.database.transaction().execute(async (transaction) => {
      if (!(await this.repository.lockForUpdate(transaction, id, ownerId)))
        throw new AppError(404, 'CASE_NOT_FOUND', 'Không tìm thấy hồ sơ.')
      const before = await this.repository.get(transaction, id, ownerId)
      if (!before) throw new AppError(500, 'CASE_LOCK_FAILED', 'Không thể đọc hồ sơ để khóa.')
      if (before.status === 'locked')
        throw new AppError(409, 'CASE_ALREADY_LOCKED', 'Hồ sơ đã khóa.')
      const summary = await this.snapshots.summary(transaction, id, ownerId)
      if (!summary) throw new AppError(404, 'CASE_NOT_FOUND', 'Không tìm thấy hồ sơ.')
      const snapshot = await this.snapshots.create(transaction, id, 'lock', summary, ownerId)
      if (!(await this.repository.lock(transaction, id, ownerId, reason)))
        throw new AppError(409, 'CASE_LOCK_CONFLICT', 'Không thể khóa hồ sơ do trạng thái đã đổi.')
      const inspectionCase = await this.repository.get(transaction, id, ownerId)
      if (!inspectionCase)
        throw new AppError(500, 'CASE_LOCK_FAILED', 'Không thể đọc hồ sơ đã khóa.')
      await this.audit.append(transaction, {
        action: 'locked',
        actorId: ownerId,
        beforeData: before,
        afterData: { snapshotId: snapshot.id, snapshotHash: snapshot.snapshotHash },
        entityId: id,
        entityType: 'inspection_case',
        inspectionCaseId: id,
        reason,
        traceId,
      })
      return { inspectionCase, snapshot }
    })
  }

  async unlock(id: string, reason: string, ownerId: string, traceId: string) {
    return this.database.transaction().execute(async (transaction) => {
      const before = await this.repository.get(transaction, id, ownerId)
      if (!before) throw new AppError(404, 'CASE_NOT_FOUND', 'Không tìm thấy hồ sơ.')
      if (before.status !== 'locked') throw new AppError(409, 'CASE_NOT_LOCKED', 'Hồ sơ chưa khóa.')
      if (!(await this.repository.unlock(transaction, id, ownerId)))
        throw new AppError(409, 'CASE_UNLOCK_CONFLICT', 'Không thể mở khóa hồ sơ.')
      const inspectionCase = await this.repository.get(transaction, id, ownerId)
      if (!inspectionCase)
        throw new AppError(500, 'CASE_UNLOCK_FAILED', 'Không thể đọc hồ sơ đã mở khóa.')
      await this.audit.append(transaction, {
        action: 'unlocked',
        actorId: ownerId,
        beforeData: before,
        afterData: { status: inspectionCase.status },
        entityId: id,
        entityType: 'inspection_case',
        inspectionCaseId: id,
        reason,
        traceId,
      })
      return { inspectionCase, snapshot: null }
    })
  }

  listWorkItems(caseId: string, ownerId: string) {
    return this.repository.listWorkItems(caseId, ownerId)
  }

  async createWorkItem(
    caseId: string,
    input: CreateWorkItemRequest,
    ownerId: string,
    traceId: string,
  ) {
    try {
      return await this.database.transaction().execute(async (transaction) => {
        const id = await this.repository.createWorkItem(transaction, caseId, ownerId, input)
        if (!id) {
          throw new AppError(
            422,
            'WORK_ITEM_SOURCE_INVALID',
            'Hồ sơ hoặc loại công tác không hợp lệ, không hoạt động, hay hồ sơ đã khóa.',
          )
        }
        const created = await this.repository.getWorkItem(transaction, id, ownerId)
        if (!created)
          throw new AppError(500, 'WORK_ITEM_CREATE_FAILED', 'Không thể đọc công tác vừa tạo.')
        await this.audit.append(transaction, {
          action: 'created',
          actorId: ownerId,
          afterData: created,
          entityId: created.id,
          entityType: 'case_work_item',
          inspectionCaseId: caseId,
          traceId,
        })
        return created
      })
    } catch (error) {
      if (error instanceof AppError) throw error
      return translateConstraint(error)
    }
  }
}
