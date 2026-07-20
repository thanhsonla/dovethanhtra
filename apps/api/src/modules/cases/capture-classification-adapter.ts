import type { ClassifyCaptureDraftRequest, WorkComponent, WorkItem } from '@dove/contracts'

import { AppError } from '../../platform/app-error.js'
import type { QueryExecutor } from '../../platform/database.js'
import type {
  CaptureClassificationPort,
  ClassificationStructure,
} from '../measurements/capture-classification-port.js'
import type { CaseRepository } from './case-repository.js'
import type { WorkStructureRepository } from './work-structure-repository.js'

export class CaseCaptureClassificationAdapter implements CaptureClassificationPort {
  constructor(
    private readonly cases: CaseRepository,
    private readonly structure: WorkStructureRepository,
  ) {}

  async resolve(
    executor: QueryExecutor,
    caseId: string,
    ownerId: string,
    input: ClassifyCaptureDraftRequest,
  ): Promise<ClassificationStructure> {
    let createdWorkItem: WorkItem | null = null
    let workItemId = input.workItemId ?? null
    if (input.createWorkItem) {
      workItemId = await this.cases.createWorkItem(executor, caseId, ownerId, input.createWorkItem)
      if (!workItemId) {
        throw new AppError(
          422,
          'WORK_ITEM_SOURCE_INVALID',
          'Không thể tạo công tác từ dữ liệu phân loại.',
        )
      }
      createdWorkItem = await this.structure.getItem(executor, workItemId, ownerId)
    }
    if (!workItemId) {
      throw new AppError(422, 'WORK_ITEM_REQUIRED', 'Phải chọn hoặc tạo một công tác.')
    }
    const workItem =
      createdWorkItem ?? (await this.structure.getItem(executor, workItemId, ownerId))
    if (!workItem || workItem.caseId !== caseId) {
      throw new AppError(404, 'WORK_ITEM_NOT_FOUND', 'Công tác không thuộc hồ sơ của nháp.')
    }

    let createdComponent: WorkComponent | null = null
    let workComponentId = input.workComponentId ?? null
    if (input.createWorkComponent) {
      workComponentId = await this.structure.createComponent(
        executor,
        workItemId,
        ownerId,
        input.createWorkComponent,
      )
      if (!workComponentId) {
        throw new AppError(409, 'WORK_ITEM_LOCKED', 'Không thể tạo mục con trong hồ sơ đã khóa.')
      }
      createdComponent = await this.structure.getComponent(executor, workComponentId, ownerId)
    }
    if (workComponentId && !createdComponent) {
      const component = await this.structure.getComponent(executor, workComponentId, ownerId)
      if (!component || component.workItemId !== workItemId) {
        throw new AppError(404, 'WORK_COMPONENT_NOT_FOUND', 'Mục con không thuộc công tác đã chọn.')
      }
    }

    return {
      createdComponent,
      createdWorkItem,
      workComponentId,
      workItemId,
    }
  }
}
