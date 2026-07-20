import type { ClassifyCaptureDraftRequest, WorkComponent, WorkItem } from '@dove/contracts'

import type { QueryExecutor } from '../../platform/database.js'

export interface ClassificationStructure {
  createdComponent: WorkComponent | null
  createdWorkItem: WorkItem | null
  workComponentId: string | null
  workItemId: string
}

export interface CaptureClassificationPort {
  resolve(
    executor: QueryExecutor,
    caseId: string,
    ownerId: string,
    input: ClassifyCaptureDraftRequest,
  ): Promise<ClassificationStructure>
}
