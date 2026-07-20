import type {
  GeoJsonGeometry,
  DrawableMeasurementGeometryKind,
  InspectionCase,
  ServiceGroup,
  WorkItem,
  WorkType,
} from '@dove/contracts'
import { useMemo, useState } from 'react'

import { api } from '../api.js'
import { DrawingToolbar } from './drawing-toolbar.js'
import {
  createHistory,
  pushHistory,
  redoHistory,
  undoHistory,
  type HistoryState,
} from './geometry-history.js'
import { geometryFromPositions, temporaryValue } from './map-geometry.js'
import { MapWorkspaceHeader } from './map-workspace-header.js'
import { mapModeLabel, quickToolDecision } from './map-quick-tool.js'
import { inheritedCalculationInputs, nextMeasurementName } from './measurement-entry-defaults.js'
import { MeasurementMap, type MapMode, type Position } from './measurement-map.js'
import { activeWorkId, measurementKindForWork, rememberActiveWork } from './map-workspace-state.js'
import { MapWorkspaceDrawers } from './map-workspace-drawers.js'
import { useMapWorkspaceResources } from './use-map-workspace-resources.js'

const emptyPositions = createHistory<Position[]>([])
export function MapWorkspace(props: {
  groups: ServiceGroup[]
  inspectionCase: InspectionCase
  onBack: () => void
  onWorkCreated: (item: WorkItem) => void
  workItems: WorkItem[]
  workTypes: WorkType[]
}) {
  const measurable = useMemo(
    () => props.workItems.filter((item) => measurementKindForWork(item, props.workTypes)),
    [props.workItems, props.workTypes],
  )
  const [error, setError] = useState('')
  const {
    basemapId,
    basemaps,
    boundary,
    facilities,
    refreshWork,
    setBasemapId,
    setSummaries,
    summaries,
  } = useMapWorkspaceResources(props.inspectionCase.id, measurable, setError)
  const [selectedWorkId, setSelectedWorkId] = useState(() =>
    activeWorkId(props.inspectionCase.id, measurable),
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [mode, setMode] = useState<MapMode>('view')
  const [positions, setPositions] = useState<HistoryState<Position[]>>(emptyPositions)
  const [draftReady, setDraftReady] = useState(false)
  const [editHistory, setEditHistory] = useState<HistoryState<GeoJsonGeometry> | null>(null)
  const [routePreview, setRoutePreview] = useState<GeoJsonGeometry | null>(null)
  const [activePanel, setActivePanel] = useState<'data' | 'details' | 'filters' | null>(null)
  const localFallbackId =
    basemaps.descriptors().find((item) => basemaps.supportsOffline(item.id))?.id ??
    basemaps.defaultId
  const selectedBasemap = basemaps.get(basemapId)

  const allMeasurements = Object.values(summaries).flatMap((summary) => summary.items)
  const selected = allMeasurements.find((item) => item.id === selectedId) ?? null
  const selectedWork = measurable.find((item) => item.id === selectedWorkId) ?? null
  const selectedSummary = selectedWork ? summaries[selectedWork.id] : undefined
  const selectedKind = selectedWork ? measurementKindForWork(selectedWork, props.workTypes) : null
  const drawableKind =
    selectedKind === 'point' || selectedKind === 'line' || selectedKind === 'area'
      ? selectedKind
      : null
  const draftGeometry =
    routePreview ??
    editHistory?.present ??
    (drawableKind ? geometryFromPositions(drawableKind, positions.present) : null)
  const editMeasurement =
    selected && editHistory ? { ...selected, rawGeometry: editHistory.present } : null
  const defaultMeasurementName = drawableKind
    ? nextMeasurementName(drawableKind, selectedSummary?.items ?? [])
    : ''
  const initialCalculationInputs = inheritedCalculationInputs(
    selectedWork,
    selectedSummary?.items ?? [],
  )

  const startDrawing = (nextMode: DrawableMeasurementGeometryKind, workItemId: string) => {
    setSelectedWorkId(workItemId)
    rememberActiveWork(props.inspectionCase.id, workItemId)
    setMode(nextMode)
    setPositions(createHistory([]))
    setEditHistory(null)
    setDraftReady(false)
    setRoutePreview(null)
    setSelectedId(null)
    setActivePanel(null)
  }

  const finishDrawing = () => {
    if (!selectedKind || !geometryFromPositions(selectedKind, positions.present)) {
      setError('Cần ít nhất 2 điểm cho tuyến hoặc 3 điểm cho vùng.')
      return
    }
    setMode('view')
    setDraftReady(true)
    setActivePanel('details')
  }

  const addPosition = (position: Position) => {
    setPositions((current) => pushHistory(current, [...current.present, position]))
    if (mode === 'point') {
      setMode('view')
      setDraftReady(true)
      setActivePanel('details')
    }
  }

  const cancelDraft = () => {
    setMode('view')
    setPositions(createHistory([]))
    setEditHistory(null)
    setDraftReady(false)
  }

  const selectWork = (item: WorkItem) => {
    setSelectedWorkId(item.id)
    rememberActiveWork(props.inspectionCase.id, item.id)
    setSelectedId(null)
    cancelDraft()
    setActivePanel(measurementKindForWork(item, props.workTypes) === 'route' ? 'details' : null)
  }

  const changeHistory = (direction: 'undo' | 'redo') => {
    if (editHistory) {
      setEditHistory(direction === 'undo' ? undoHistory(editHistory) : redoHistory(editHistory))
    } else {
      setPositions(direction === 'undo' ? undoHistory(positions) : redoHistory(positions))
    }
  }

  const selectMeasurement = (id: string) => {
    const measurement = allMeasurements.find((item) => item.id === id)
    if (!measurement) return
    setSelectedId(id)
    setSelectedWorkId(measurement.workItemId)
    rememberActiveWork(props.inspectionCase.id, measurement.workItemId)
    setMode('view')
    setEditHistory(null)
    setDraftReady(false)
    setActivePanel('details')
  }

  const startQuickTool = (kind: DrawableMeasurementGeometryKind) => {
    const decision = quickToolDecision(
      kind,
      props.inspectionCase.status === 'locked',
      selectedWork,
      measurable,
      props.workTypes,
    )
    if (!decision.target) {
      if (decision.openData) setActivePanel('data')
      setError(decision.error ?? 'Không thể bắt đầu phép đo.')
      return
    }
    startDrawing(kind, decision.target.id)
  }

  if (!boundary) {
    return (
      <main className="map-loading" role="status">
        Đang tải không gian bản đồ…
      </main>
    )
  }

  return (
    <main className="map-shell">
      <MapWorkspaceHeader
        basemapId={basemapId}
        basemaps={basemaps}
        inspectionCase={props.inspectionCase}
        onBack={() => props.onBack()}
        onBasemapChange={setBasemapId}
      />
      {error && (
        <div className="alert map-alert" role="alert">
          {error}
        </div>
      )}
      <section className="map-layout">
        <section className="map-stage">
          <DrawingToolbar
            activePanel={activePanel}
            canDelete={false}
            canFinish={
              (mode === 'line' && positions.present.length >= 2) ||
              (mode === 'area' && positions.present.length >= 3)
            }
            canRedo={Boolean((editHistory ?? positions).future.length)}
            canUndo={Boolean((editHistory ?? positions).past.length)}
            mode={mode}
            onCancel={cancelDraft}
            onDelete={() => undefined}
            onFinish={finishDrawing}
            onHistory={changeHistory}
            onOpenPanel={(panel) => setActivePanel((current) => (current === panel ? null : panel))}
            onStart={startQuickTool}
          />
          <MeasurementMap
            basemapId={basemapId}
            basemapProvider={basemaps}
            boundary={boundary}
            draftGeometry={draftGeometry}
            draftPositions={positions.present}
            editMeasurement={editMeasurement}
            hiddenWorkItemIds={hidden}
            measurements={allMeasurements}
            mode={mode}
            onAddPosition={addPosition}
            onEditGeometry={(geometry) =>
              setEditHistory((history) =>
                history ? pushHistory(history, geometry) : createHistory(geometry),
              )
            }
            onFinishDrawing={finishDrawing}
            onBasemapFallback={() => {
              const fallbackId =
                basemapId === 'google-hybrid-upright' ? 'google-hybrid-direct' : localFallbackId
              setBasemapId(fallbackId)
              setError(
                fallbackId === 'google-hybrid-direct'
                  ? 'Không tải được lớp nhãn thẳng; đã chuyển sang Google hybrid raster.'
                  : 'Không tải được nền đã cấu hình; đã chuyển sang nền kỹ thuật local.',
              )
            }}
            onSelect={selectMeasurement}
            selectedId={selectedId}
          />
          {(mode === 'line' || mode === 'area') && (
            <output
              className="map-live-result"
              aria-label="Kết quả đo trực tiếp"
              aria-live="polite"
            >
              <span>{mode === 'line' ? 'Tổng tuyến bổ sung' : 'Diện tích vùng bổ sung'}</span>
              <strong>{temporaryValue(draftGeometry)}</strong>
            </output>
          )}
          <div className="map-status-sr" aria-live="polite">
            Chế độ {mapModeLabel(mode)}. Nền {selectedBasemap.label}.
          </div>
        </section>

        <MapWorkspaceDrawers
          activePanel={activePanel}
          data={{
            inspectionCase: props.inspectionCase,
            mode,
            onConfirm: async (measurement) => {
              try {
                const confirmed = await api.confirmMeasurement(measurement.id)
                setSelectedId(confirmed.id)
                await refreshWork(confirmed.workItemId)
              } catch (reason) {
                setError(reason instanceof Error ? reason.message : 'Không thể xác nhận phép đo.')
              }
            },
            onError: setError,
            onOpenDetails: () => setActivePanel('details'),
            onSelectMeasurement: (measurement) => selectMeasurement(measurement.id),
            onSelectWork: selectWork,
            onStart: startDrawing,
            onWorkCreated: props.onWorkCreated,
            selectedWork,
            selectedWorkId,
            summaries,
            summary: selectedSummary,
            workItems: measurable,
            workTypes: props.workTypes,
          }}
          details={{
            defaultName: defaultMeasurementName,
            draftGeometry,
            draftReady,
            facilities,
            initialCalculationInputs,
            measurement: selected,
            selectedKind,
            selectedWork,
            onCancel: () => {
              cancelDraft()
              setActivePanel(null)
            },
            onChanged: async (measurement) => {
              cancelDraft()
              setSelectedId(measurement.id)
              await refreshWork(measurement.workItemId)
            },
            onDataChanged: async (measurement) => {
              if (measurement) setSelectedId(measurement.id)
              if (selectedWork) await refreshWork(selectedWork.id)
            },
            onEdit: () => {
              if (selected) {
                setEditHistory(createHistory(selected.rawGeometry))
                setMode('edit')
              }
            },
            onError: setError,
            onRoutePreview: setRoutePreview,
            onRouteSaved: async (route) => {
              setSelectedId(route.measurement.id)
              await refreshWork(route.measurement.workItemId)
            },
            onSaved: async (measurement, action) => {
              if (action === 'continue' && drawableKind) {
                startDrawing(drawableKind, measurement.workItemId)
                await refreshWork(measurement.workItemId)
                return
              }
              cancelDraft()
              setSelectedId(measurement.id)
              await refreshWork(measurement.workItemId)
            },
          }}
          filters={{
            groups: props.groups,
            hidden,
            measurable,
            onLoadMore: (workItemId, cursor) =>
              void api
                .listMeasurements(workItemId, { cursor, limit: 200 })
                .then((page) =>
                  setSummaries((current) => ({
                    ...current,
                    [workItemId]: {
                      ...page,
                      items: [...current[workItemId]!.items, ...page.items],
                    },
                  })),
                )
                .catch((reason) =>
                  setError(
                    reason instanceof Error ? reason.message : 'Không nạp được trang tiếp theo.',
                  ),
                ),
            onSelectMeasurement: selectMeasurement,
            onSelectWork: selectWork,
            onToggleWork: (id) =>
              setHidden((current) => {
                const next = new Set(current)
                if (next.has(id)) next.delete(id)
                else next.add(id)
                return next
              }),
            selectedId,
            selectedWorkId,
            summaries,
            workTypes: props.workTypes,
          }}
          onClose={() => setActivePanel(null)}
        />
      </section>
    </main>
  )
}
