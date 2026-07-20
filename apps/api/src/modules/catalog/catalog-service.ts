import type {
  CreateServiceGroupRequest,
  CreateWorkTypeRequest,
  UpdateServiceGroupRequest,
  UpdateWorkTypeRequest,
} from '@dove/contracts'

import { AppError } from '../../platform/app-error.js'
import type { AppDatabase } from '../../platform/database.js'
import type { AuditRepository } from '../audit/audit-repository.js'
import type { CatalogRepository } from './catalog-repository.js'

export class CatalogService {
  constructor(
    private readonly database: AppDatabase,
    private readonly repository: CatalogRepository,
    private readonly audit: AuditRepository,
  ) {}

  listServiceGroups(includeInactive: boolean) {
    return this.repository.listServiceGroups(includeInactive)
  }

  listWorkTypes(includeInactive: boolean) {
    return this.repository.listWorkTypes(includeInactive)
  }

  async createServiceGroup(input: CreateServiceGroupRequest, actorId: string, traceId: string) {
    if (input.quickDefault && !input.quickLabel?.trim()) {
      throw new AppError(422, 'QUICK_LABEL_REQUIRED', 'Lĩnh vực hiển thị nhanh phải có nhãn ngắn.')
    }
    try {
      return await this.database.transaction().execute(async (transaction) => {
        const created = await this.repository.createServiceGroup(transaction, input)
        await this.audit.append(transaction, {
          action: 'created',
          actorId,
          afterData: created,
          entityId: created.id,
          entityType: 'service_group',
          traceId,
        })
        return created
      })
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new AppError(409, 'CATALOG_CODE_EXISTS', 'Mã nhóm dịch vụ đã tồn tại.')
      }
      throw error
    }
  }

  async updateServiceGroup(
    id: string,
    expectedVersion: number,
    input: UpdateServiceGroupRequest,
    actorId: string,
    traceId: string,
  ) {
    return this.database.transaction().execute(async (transaction) => {
      const before = await this.repository.getServiceGroup(transaction, id)
      if (!before)
        throw new AppError(404, 'SERVICE_GROUP_NOT_FOUND', 'Không tìm thấy nhóm dịch vụ.')
      const quickDefault = input.quickDefault ?? before.quickDefault
      const quickLabel = Object.hasOwn(input, 'quickLabel') ? input.quickLabel : before.quickLabel
      if (quickDefault && !quickLabel?.trim()) {
        throw new AppError(
          422,
          'QUICK_LABEL_REQUIRED',
          'Lĩnh vực hiển thị nhanh phải có nhãn ngắn.',
        )
      }
      const updated = await this.repository.updateServiceGroup(
        transaction,
        id,
        expectedVersion,
        input,
      )
      if (!updated)
        throw new AppError(409, 'VERSION_CONFLICT', 'Nhóm dịch vụ đã được thay đổi ở nơi khác.')
      await this.audit.append(transaction, {
        action: updated.active ? 'updated' : 'deactivated',
        actorId,
        afterData: updated,
        beforeData: before,
        entityId: updated.id,
        entityType: 'service_group',
        traceId,
      })
      return updated
    })
  }

  async removeServiceGroup(
    id: string,
    expectedVersion: number,
    reason: string,
    actorId: string,
    traceId: string,
  ) {
    return this.database.transaction().execute(async (transaction) => {
      const before = await this.repository.getServiceGroup(transaction, id)
      if (!before)
        throw new AppError(404, 'SERVICE_GROUP_NOT_FOUND', 'Không tìm thấy nhóm dịch vụ.')
      if (await this.repository.hasActiveServiceChildren(transaction, id)) {
        throw new AppError(409, 'SERVICE_GROUP_IN_USE', 'Nhóm dịch vụ còn công tác đang hoạt động.')
      }
      const deleted = await this.repository.softDeleteServiceGroup(transaction, id, expectedVersion)
      if (!deleted)
        throw new AppError(409, 'VERSION_CONFLICT', 'Nhóm dịch vụ đã được thay đổi ở nơi khác.')
      await this.audit.append(transaction, {
        action: 'soft_deleted',
        actorId,
        beforeData: before,
        afterData: deleted,
        entityId: id,
        entityType: 'service_group',
        reason,
        traceId,
      })
      return deleted
    })
  }

  async restoreServiceGroup(
    id: string,
    expectedVersion: number,
    reason: string,
    actorId: string,
    traceId: string,
  ) {
    return this.database.transaction().execute(async (transaction) => {
      const before = await this.repository.getServiceGroup(transaction, id, true)
      if (!before)
        throw new AppError(
          404,
          'SERVICE_GROUP_NOT_FOUND',
          'Không tìm thấy nhóm dịch vụ đã lưu trữ.',
        )
      const restored = await this.repository.restoreServiceGroup(transaction, id, expectedVersion)
      if (!restored)
        throw new AppError(409, 'VERSION_CONFLICT', 'Nhóm dịch vụ đã được thay đổi ở nơi khác.')
      await this.audit.append(transaction, {
        action: 'restored',
        actorId,
        beforeData: before,
        afterData: restored,
        entityId: id,
        entityType: 'service_group',
        reason,
        traceId,
      })
      return restored
    })
  }

  async createWorkType(input: CreateWorkTypeRequest, actorId: string, traceId: string) {
    try {
      return await this.database.transaction().execute(async (transaction) => {
        const created = await this.repository.createWorkType(transaction, input)
        await this.audit.append(transaction, {
          action: 'created',
          actorId,
          afterData: created,
          entityId: created.id,
          entityType: 'work_type',
          traceId,
        })
        return created
      })
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new AppError(409, 'WORK_TYPE_VERSION_EXISTS', 'Mã và phiên bản công tác đã tồn tại.')
      }
      throw error
    }
  }

  async updateWorkType(id: string, input: UpdateWorkTypeRequest, actorId: string, traceId: string) {
    return this.database.transaction().execute(async (transaction) => {
      const updated = await this.repository.updateWorkType(transaction, id, input)
      if (!updated) throw new AppError(404, 'WORK_TYPE_NOT_FOUND', 'Không tìm thấy loại công tác.')
      await this.audit.append(transaction, {
        action: updated.active ? 'updated' : 'deactivated',
        actorId,
        afterData: updated,
        entityId: updated.id,
        entityType: 'work_type',
        traceId,
      })
      return updated
    })
  }
}
