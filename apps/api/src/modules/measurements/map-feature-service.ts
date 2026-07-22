import type { MeasurementGeometryKind, MeasurementStatus } from '@dove/contracts'

import { AppError } from '../../platform/app-error.js'
import { decodeCursor, encodeCursor } from '../../platform/cursor.js'
import type { MapFeatureRepository } from './map-feature-repository.js'

export interface MapFeatureQuery {
  bbox?: [number, number, number, number]
  componentId?: string
  cursor?: string
  geometryKind?: MeasurementGeometryKind
  limit: number
  managementZoneId?: string
  search?: string
  serviceGroupId?: string
  status?: MeasurementStatus
  workItemId?: string
}

export class MapFeatureService {
  constructor(private readonly repository: MapFeatureRepository) {}

  async list(caseId: string, ownerId: string, query: MapFeatureQuery) {
    if (!(await this.repository.caseExists(caseId, ownerId))) {
      throw new AppError(404, 'CASE_NOT_FOUND', 'Không tìm thấy hồ sơ.')
    }
    const { cursor: rawCursor, search: rawSearch, ...baseFilters } = query
    const cursor = decodeCursor(rawCursor)
    const search = rawSearch?.trim()
    const filters = {
      ...baseFilters,
      ...(cursor ? { cursor } : {}),
      ...(search ? { search } : {}),
    }
    const [page, confirmedTotals] = await Promise.all([
      this.repository.list(caseId, ownerId, filters),
      this.repository.confirmedTotals(caseId, ownerId, filters),
    ])
    return {
      confirmedTotals,
      items: page.items,
      nextCursor: page.nextCursor ? encodeCursor(page.nextCursor) : null,
    }
  }
}
