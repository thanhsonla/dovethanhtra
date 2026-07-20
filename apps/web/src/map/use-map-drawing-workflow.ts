import type { DrawableMeasurementGeometryKind, GeoJsonGeometry } from '@dove/contracts'
import { useCallback, useReducer, useState, type ComponentProps } from 'react'

import type { CaptureDraftPanel } from './capture-draft-panel.js'
import { createDrawingState, drawingReducer } from './drawing-state.js'
import { geometryFromPositions } from './map-geometry.js'
import type { MapPanelName } from './drawing-toolbar.js'
import type { MapMode, Position } from './measurement-map.js'
import type { StoredCaptureDraft } from '../field/offline-store.js'
import { useCaptureDraftSync } from './use-capture-draft-sync.js'

type DrawingTarget = 'capture' | 'measurement'

export function useMapDrawingWorkflow(options: {
  caseId: string
  locked: boolean
  onError: (message: string) => void
  onPanel: (panel: MapPanelName | null) => void
  onClassifyReady: (draft: StoredCaptureDraft) => void
}) {
  const [mode, setMode] = useState<MapMode>('view')
  const [drawing, dispatchDrawing] = useReducer(drawingReducer, undefined, () =>
    createDrawingState(),
  )
  const [target, setTarget] = useState<DrawingTarget>('capture')
  const [capturePending, setCapturePending] = useState<{
    geometry: GeoJsonGeometry
    kind: DrawableMeasurementGeometryKind
  } | null>(null)
  const [savingCapture, setSavingCapture] = useState(false)
  const [draftReady, setDraftReady] = useState(false)
  const reportError = useCallback((message: string) => options.onError(message), [options.onError])
  const captureSync = useCaptureDraftSync(options.caseId, reportError)

  const start = (kind: DrawableMeasurementGeometryKind, nextTarget: DrawingTarget) => {
    if (nextTarget === 'capture' && options.locked) {
      options.onError('Hồ sơ đã khóa nên không thể thêm nháp mới.')
      return false
    }
    options.onError('')
    setTarget(nextTarget)
    setMode(kind)
    dispatchDrawing({ type: 'reset' })
    setCapturePending(null)
    setDraftReady(false)
    options.onPanel(null)
    return true
  }

  const finish = () => {
    if (mode !== 'point' && mode !== 'line' && mode !== 'area') return
    const geometry = geometryFromPositions(mode, drawing.history.present)
    if (!geometry) {
      options.onError('Cần ít nhất 2 điểm cho tuyến hoặc 3 điểm cho vùng.')
      return
    }
    setMode('view')
    if (target === 'capture') {
      setCapturePending({ geometry, kind: mode })
      options.onPanel('capture')
    } else {
      setDraftReady(true)
      options.onPanel('details')
    }
  }

  const addPosition = (position: Position) => {
    dispatchDrawing({ position, type: 'add' })
    if (mode !== 'point') return
    setMode('view')
    if (target === 'capture') {
      setCapturePending({ geometry: { coordinates: position, type: 'Point' }, kind: 'point' })
      options.onPanel('capture')
    } else {
      setDraftReady(true)
      options.onPanel('details')
    }
  }

  const cancel = () => {
    setMode('view')
    dispatchDrawing({ type: 'reset' })
    setCapturePending(null)
    setDraftReady(false)
  }

  const capturePanel: ComponentProps<typeof CaptureDraftPanel> | null = capturePending
    ? {
        geometry: capturePending.geometry,
        kind: capturePending.kind,
        onCancel: () => {
          cancel()
          options.onPanel(null)
        },
        onSave: () => {
          setSavingCapture(true)
          void captureSync
            .save(capturePending.kind, capturePending.geometry)
            .then(() => options.onPanel(null))
            .catch((reason) =>
              options.onError(reason instanceof Error ? reason.message : 'Không thể lưu nháp.'),
            )
            .finally(() => setSavingCapture(false))
        },
        onSaveAndClassify: () => {
          setSavingCapture(true)
          void captureSync
            .save(capturePending.kind, capturePending.geometry)
            .then((draft) => {
              if (draft.serverDraft) options.onClassifyReady(draft)
              else {
                options.onError('Nháp đã lưu trên thiết bị. Có thể phân loại sau khi có mạng.')
                options.onPanel(null)
              }
            })
            .catch((reason) =>
              options.onError(reason instanceof Error ? reason.message : 'Không thể lưu nháp.'),
            )
            .finally(() => setSavingCapture(false))
        },
        saving: savingCapture,
      }
    : null

  return {
    addPosition,
    cancel,
    capturePanel,
    capturePending,
    captureSync,
    clearCapture: () => setCapturePending(null),
    dispatchDrawing,
    draftReady,
    drawing,
    finish,
    mode,
    setDraftReady,
    setMode,
    start,
  }
}
