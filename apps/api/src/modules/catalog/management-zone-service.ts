import type { CreateManagementZoneRequest, UpdateManagementZoneRequest } from '@dove/contracts'

import { AppError } from '../../platform/app-error.js'
import type { AppDatabase } from '../../platform/database.js'
import type { AuditRepository } from '../audit/audit-repository.js'
import type { ManagementZoneRepository } from './management-zone-repository.js'

export class ManagementZoneService {
  constructor(
    private readonly database: AppDatabase,
    private readonly repository: ManagementZoneRepository,
    private readonly audit: AuditRepository,
  ) {}

  list(includeDeleted: boolean) {
    return this.repository.list(includeDeleted)
  }

  async create(input: CreateManagementZoneRequest, actorId: string, traceId: string) {
    try {
      return await this.database.transaction().execute(async (transaction) => {
        const created = await this.repository.create(transaction, input)
        await this.audit.append(transaction, {
          action: 'created',
          actorId,
          afterData: created,
          entityId: created.id,
          entityType: 'management_zone',
          traceId,
        })
        return created
      })
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new AppError(409, 'MANAGEMENT_ZONE_CODE_EXISTS', 'Mã khu vực đã tồn tại.')
      }
      throw error
    }
  }

  async update(
    id: string,
    version: number,
    input: UpdateManagementZoneRequest,
    actorId: string,
    traceId: string,
  ) {
    return this.database.transaction().execute(async (transaction) => {
      const before = await this.repository.get(transaction, id)
      if (!before) throw new AppError(404, 'MANAGEMENT_ZONE_NOT_FOUND', 'Không tìm thấy khu vực.')
      const updated = await this.repository.update(transaction, id, version, input)
      if (!updated)
        throw new AppError(409, 'VERSION_CONFLICT', 'Khu vực đã được thay đổi ở nơi khác.')
      await this.audit.append(transaction, {
        action: 'updated',
        actorId,
        afterData: updated,
        beforeData: before,
        entityId: id,
        entityType: 'management_zone',
        traceId,
      })
      return updated
    })
  }

  async remove(id: string, version: number, reason: string, actorId: string, traceId: string) {
    return this.database.transaction().execute(async (transaction) => {
      const before = await this.repository.get(transaction, id)
      if (!before) throw new AppError(404, 'MANAGEMENT_ZONE_NOT_FOUND', 'Không tìm thấy khu vực.')
      if (await this.repository.hasActiveWorkItems(transaction, id)) {
        throw new AppError(409, 'MANAGEMENT_ZONE_IN_USE', 'Khu vực đang được công tác sử dụng.')
      }
      const deleted = await this.repository.softDelete(transaction, id, version)
      if (!deleted)
        throw new AppError(409, 'VERSION_CONFLICT', 'Khu vực đã được thay đổi ở nơi khác.')
      await this.audit.append(transaction, {
        action: 'soft_deleted',
        actorId,
        beforeData: before,
        afterData: deleted,
        entityId: id,
        entityType: 'management_zone',
        reason,
        traceId,
      })
      return deleted
    })
  }

  async restore(id: string, version: number, reason: string, actorId: string, traceId: string) {
    return this.database.transaction().execute(async (transaction) => {
      const before = await this.repository.get(transaction, id, true)
      if (!before)
        throw new AppError(404, 'MANAGEMENT_ZONE_NOT_FOUND', 'Không tìm thấy khu vực đã lưu trữ.')
      const restored = await this.repository.restore(transaction, id, version)
      if (!restored)
        throw new AppError(409, 'VERSION_CONFLICT', 'Khu vực đã được thay đổi ở nơi khác.')
      await this.audit.append(transaction, {
        action: 'restored',
        actorId,
        beforeData: before,
        afterData: restored,
        entityId: id,
        entityType: 'management_zone',
        reason,
        traceId,
      })
      return restored
    })
  }
}
