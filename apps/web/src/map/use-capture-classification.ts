import type { ClassifyCaptureDraftResponse, WorkItem } from '@dove/contracts'
import { useState, type ComponentProps, type Dispatch, type SetStateAction } from 'react'

import { api } from '../api.js'
import type { StoredCaptureDraft } from '../field/offline-store.js'
import type { CaptureClassificationPanel } from './capture-classification-panel.js'
import type { MapPanelName } from './drawing-toolbar.js'
import type { useCaptureDraftSync } from './use-capture-draft-sync.js'

export function useClassificationSelection(onPanel: (panel: MapPanelName | null) => void) {
  const [localId, setLocalId] = useState<string | null>(null)
  return {
    clear: () => setLocalId(null),
    find: (drafts: StoredCaptureDraft[]) => drafts.find((item) => item.localId === localId) ?? null,
    open: (draft: StoredCaptureDraft) => {
      setLocalId(draft.localId)
      onPanel('classification')
    },
  }
}

export function classificationPanelProps(options: {
  captureSync: ReturnType<typeof useCaptureDraftSync>
  clearCapture: () => void
  draft: StoredCaptureDraft | null
  onError: (message: string) => void
  onPanel: (panel: MapPanelName | null) => void
  onStart: (kind: StoredCaptureDraft['input']['geometryKind']) => void
  refreshWork: (workItemId: string) => Promise<unknown>
  selection: ReturnType<typeof useClassificationSelection>
  setSelectedId: Dispatch<SetStateAction<string | null>>
  setSelectedWorkId: Dispatch<SetStateAction<string>>
  workspace: {
    groups: ComponentProps<typeof CaptureClassificationPanel>['groups']
    inspectionCase: { id: string }
    onWorkCreated: (item: WorkItem) => void
    workItems: WorkItem[]
    workTypes: ComponentProps<typeof CaptureClassificationPanel>['workTypes']
  }
}): ComponentProps<typeof CaptureClassificationPanel> | null {
  if (!options.draft) return null
  const draft = options.draft
  return {
    draft,
    groups: options.workspace.groups,
    onDone: async (result: ClassifyCaptureDraftResponse, continueDrawing: boolean) => {
      const latestItems = await api.listWorkItems(options.workspace.inspectionCase.id)
      latestItems
        .filter((item) => !options.workspace.workItems.some((current) => current.id === item.id))
        .forEach(options.workspace.onWorkCreated)
      options.setSelectedWorkId(result.measurement.workItemId)
      options.setSelectedId(result.measurement.id)
      await options.refreshWork(result.measurement.workItemId)
      options.selection.clear()
      options.onPanel(null)
      options.clearCapture()
      if (continueDrawing) options.onStart(draft.input.geometryKind)
    },
    onReload: async () => {
      await options.captureSync.reload(draft)
      options.onError('Đã tải lại phiên bản nháp mới nhất từ máy chủ.')
    },
    onSubmit: (input, key) => options.captureSync.classify(draft, input, key),
    workItems: options.workspace.workItems,
    workTypes: options.workspace.workTypes,
  }
}
