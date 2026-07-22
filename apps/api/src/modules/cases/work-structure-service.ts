import type {
  CreateWorkComponentRequest,
  UpdateWorkComponentRequest,
  UpdateWorkItemRequest,
} from '@dove/contracts'

import { AppError } from '../../platform/app-error.js'
import type { AppDatabase } from '../../platform/database.js'
import type { AuditRepository } from '../audit/audit-repository.js'
import type { WorkStructureRepository } from './work-structure-repository.js'

export class WorkStructureService {
  constructor(
    private readonly database: AppDatabase,
    private readonly repository: WorkStructureRepository,
    private readonly audit: AuditRepository,
  ) {}

  listComponents(workItemId: string, ownerId: string, includeDeleted: boolean) {
    return this.repository.listComponents(workItemId, ownerId, includeDeleted)
  }

  async updateItem(
    id: string,
    version: number,
    input: UpdateWorkItemRequest,
    ownerId: string,
    traceId: string,
  ) {
    try {
      return await this.database.transaction().execute(async (transaction) => {
        const before = await this.repository.getItem(transaction, id, ownerId)
        if (!before) throw new AppError(404, 'WORK_ITEM_NOT_FOUND', 'Không tìm thấy công tác.')
        if (
          input.workTypeId &&
          !(await this.repository.isCompatibleWorkType(transaction, id, ownerId, input.workTypeId))
        ) {
          throw new AppError(
            422,
            'WORK_TYPE_INCOMPATIBLE',
            'Dịch vụ được chọn không hỗ trợ loại hình học của phép đo.',
          )
        }
        const updatedId = await this.repository.updateItem(transaction, id, ownerId, version, input)
        if (!updatedId)
          throw new AppError(409, 'VERSION_CONFLICT', 'Công tác đã thay đổi hoặc hồ sơ đã khóa.')
        const updated = await this.repository.getItem(transaction, id, ownerId)
        await this.audit.append(transaction, {
          action: 'updated',
          actorId: ownerId,
          beforeData: before,
          afterData: updated,
          entityId: id,
          entityType: 'case_work_item',
          inspectionCaseId: before.caseId,
          traceId,
        })
        return updated!
      })
    } catch (error) {
      if (error instanceof AppError) throw error
      if ((error as { constraint?: string }).constraint?.includes('dates')) {
        throw new AppError(422, 'DATE_RANGE_INVALID', 'Ngày kết thúc phải từ ngày bắt đầu trở đi.')
      }
      throw error
    }
  }

  async removeItem(id: string, version: number, reason: string, ownerId: string, traceId: string) {
    return this.database.transaction().execute(async (transaction) => {
      const before = await this.repository.getItem(transaction, id, ownerId)
      if (!before) throw new AppError(404, 'WORK_ITEM_NOT_FOUND', 'Không tìm thấy công tác.')
      if (await this.repository.itemHasChildren(transaction, id)) {
        throw new AppError(409, 'WORK_ITEM_HAS_DATA', 'Hãy lưu trữ các mục con và phép đo trước.')
      }
      if (!(await this.repository.softDeleteItem(transaction, id, ownerId, version))) {
        throw new AppError(409, 'VERSION_CONFLICT', 'Công tác đã thay đổi hoặc hồ sơ đã khóa.')
      }
      const deleted = await this.repository.getItem(transaction, id, ownerId, true)
      await this.audit.append(transaction, {
        action: 'soft_deleted',
        actorId: ownerId,
        beforeData: before,
        afterData: deleted,
        entityId: id,
        entityType: 'case_work_item',
        inspectionCaseId: before.caseId,
        reason,
        traceId,
      })
      return deleted!
    })
  }

  async restoreItem(id: string, version: number, reason: string, ownerId: string, traceId: string) {
    return this.database.transaction().execute(async (transaction) => {
      const before = await this.repository.getItem(transaction, id, ownerId, true)
      if (!before)
        throw new AppError(404, 'WORK_ITEM_NOT_FOUND', 'Không tìm thấy công tác đã lưu trữ.')
      if (!(await this.repository.restoreItem(transaction, id, ownerId, version))) {
        throw new AppError(
          409,
          'WORK_ITEM_RESTORE_BLOCKED',
          'Dữ liệu cha không hoạt động, hồ sơ đã khóa hoặc phiên bản đã đổi.',
        )
      }
      const restored = await this.repository.getItem(transaction, id, ownerId)
      await this.audit.append(transaction, {
        action: 'restored',
        actorId: ownerId,
        beforeData: before,
        afterData: restored,
        entityId: id,
        entityType: 'case_work_item',
        inspectionCaseId: before.caseId,
        reason,
        traceId,
      })
      return restored!
    })
  }

  async createComponent(
    workItemId: string,
    input: CreateWorkComponentRequest,
    ownerId: string,
    traceId: string,
  ) {
    return this.database.transaction().execute(async (transaction) => {
      const parent = await this.repository.getItem(transaction, workItemId, ownerId)
      if (!parent) throw new AppError(404, 'WORK_ITEM_NOT_FOUND', 'Không tìm thấy công tác.')
      const id = await this.repository.createComponent(transaction, workItemId, ownerId, input)
      if (!id)
        throw new AppError(409, 'WORK_ITEM_LOCKED', 'Không thể thêm mục con vào hồ sơ đã khóa.')
      const created = await this.repository.getComponent(transaction, id, ownerId)
      await this.audit.append(transaction, {
        action: 'created',
        actorId: ownerId,
        afterData: created,
        entityId: id,
        entityType: 'work_component',
        inspectionCaseId: parent.caseId,
        traceId,
      })
      return created!
    })
  }

  async updateComponent(
    id: string,
    version: number,
    input: UpdateWorkComponentRequest,
    ownerId: string,
    traceId: string,
  ) {
    return this.database.transaction().execute(async (transaction) => {
      const before = await this.repository.getComponent(transaction, id, ownerId)
      if (!before) throw new AppError(404, 'WORK_COMPONENT_NOT_FOUND', 'Không tìm thấy mục con.')
      if (!(await this.repository.updateComponent(transaction, id, ownerId, version, input))) {
        throw new AppError(409, 'VERSION_CONFLICT', 'Mục con đã thay đổi hoặc hồ sơ đã khóa.')
      }
      const updated = await this.repository.getComponent(transaction, id, ownerId)
      const parent = await this.repository.getItem(transaction, before.workItemId, ownerId)
      await this.audit.append(transaction, {
        action: 'updated',
        actorId: ownerId,
        beforeData: before,
        afterData: updated,
        entityId: id,
        entityType: 'work_component',
        inspectionCaseId: parent!.caseId,
        traceId,
      })
      return updated!
    })
  }

  async setComponentDeleted(
    id: string,
    version: number,
    reason: string,
    ownerId: string,
    traceId: string,
    restore: boolean,
  ) {
    return this.database.transaction().execute(async (transaction) => {
      const before = await this.repository.getComponent(transaction, id, ownerId, restore)
      if (!before) throw new AppError(404, 'WORK_COMPONENT_NOT_FOUND', 'Không tìm thấy mục con.')
      if (!restore && (await this.repository.componentHasMeasurements(transaction, id))) {
        throw new AppError(
          409,
          'WORK_COMPONENT_HAS_DATA',
          'Mục con đang có phép đo; không thể lưu trữ.',
        )
      }
      if (
        !(await this.repository.setComponentDeleted(transaction, id, ownerId, version, restore))
      ) {
        throw new AppError(409, 'VERSION_CONFLICT', 'Mục con đã thay đổi hoặc hồ sơ đã khóa.')
      }
      const changed = await this.repository.getComponent(transaction, id, ownerId, !restore)
      const parent = await this.repository.getItem(transaction, before.workItemId, ownerId)
      await this.audit.append(transaction, {
        action: restore ? 'restored' : 'soft_deleted',
        actorId: ownerId,
        beforeData: before,
        afterData: changed,
        entityId: id,
        entityType: 'work_component',
        inspectionCaseId: parent!.caseId,
        reason,
        traceId,
      })
      return changed!
    })
  }
}
