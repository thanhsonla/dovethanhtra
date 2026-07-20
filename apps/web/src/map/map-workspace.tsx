import type {
  GeoJsonGeometry,
  DrawableMeasurementGeometryKind,
  InspectionCase,
  MeasurementListResponse,
  ServiceGroup,
  WorkItem,
  WorkType,
  TreatmentFacility,
} from '@dove/contracts'
import { useEffect, useMemo, useState } from 'react'

import { api } from '../api.js'
import { createBasemapProvider } from './basemap-provider.js'
import { DrawingToolbar } from './drawing-toolbar.js'
import {
  createHistory,
  pushHistory,
  redoHistory,
  undoHistory,
  type HistoryState,
} from './geometry-history.js'
import { geometryFromPositions, temporaryValue } from './map-geometry.js'
import { MapDetailsPanel } from './map-details-panel.js'
import { MapWorkspaceHeader } from './map-workspace-header.js'
import { inheritedCalculationInputs, nextMeasurementName } from './measurement-entry-defaults.js'
import { MeasurementLayerTree } from './measurement-layer-tree.js'
import { MeasurementMap, type MapMode, type Position } from './measurement-map.js'
import { activeWorkId, measurementKindForWork, rememberActiveWork } from './map-workspace-state.js'
import { MapQuickWorkflow } from './map-quick-workflow.js'

const emptyPositions = createHistory<Position[]>([])
const modeLabels: Record<MapMode, string> = {
  area: 'Vẽ vùng',
  edit: 'Hiệu chỉnh',
  line: 'Vẽ tuyến',
  point: 'Vẽ điểm',
  view: 'Xem',
}
export function MapWorkspace(props: {
  groups: ServiceGroup[]
  inspectionCase: InspectionCase
  onBack(): void
  onWorkCreated(item: WorkItem): void
  workItems: WorkItem[]
  workTypes: WorkType[]
}) {
  const measurable = useMemo(
    () => props.workItems.filter((item) => measurementKindForWork(item, props.workTypes)),
    [props.workItems, props.workTypes],
  )
  const [basemaps, setBasemaps] = useState(() => createBasemapProvider())
  const [boundary, setBoundary] = useState<GeoJsonGeometry | null>(null)
  const [summaries, setSummaries] = useState<Record<string, MeasurementListResponse>>({})
  const [selectedWorkId, setSelectedWorkId] = useState(() =>
    activeWorkId(props.inspectionCase.id, measurable),
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [mode, setMode] = useState<MapMode>('view')
  const [positions, setPositions] = useState<HistoryState<Position[]>>(emptyPositions)
  const [draftReady, setDraftReady] = useState(false)
  const [editHistory, setEditHistory] = useState<HistoryState<GeoJsonGeometry> | null>(null)
  const [basemapId, setBasemapId] = useState(basemaps.defaultId)
  const [error, setError] = useState('')
  const [facilities, setFacilities] = useState<TreatmentFacility[]>([])
  const [routePreview, setRoutePreview] = useState<GeoJsonGeometry | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const localFallbackId =
    basemaps.descriptors().find((item) => basemaps.supportsOffline(item.id))?.id ??
    basemaps.defaultId
  const selectedBasemap = basemaps.get(basemapId)

  const refreshWork = async (workItemId: string) => {
    const summary = await api.listMeasurements(workItemId, { limit: 200 })
    setSummaries((current) => ({ ...current, [workItemId]: summary }))
    return summary
  }

  useEffect(() => {
    void api
      .basemapCapabilities()
      .then((capabilities) => {
        if (!capabilities.googleMapTiles) return
        const next = createBasemapProvider(undefined, capabilities)
        setBasemaps(next)
        setBasemapId(next.defaultId)
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    void Promise.all([
      api.getCaseMapContext(props.inspectionCase.id),
      api.listTreatmentFacilities(),
      ...measurable.map((item) => api.listMeasurements(item.id, { limit: 200 })),
    ])
      .then(([context, treatmentFacilities, ...items]) => {
        setBoundary(context.boundary)
        setFacilities(treatmentFacilities)
        setSummaries(
          Object.fromEntries(measurable.map((workItem, index) => [workItem.id, items[index]!])),
        )
      })
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : 'Không tải được bản đồ.'),
      )
  }, [props.inspectionCase.id])

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
    setDetailsOpen(false)
  }

  const finishDrawing = () => {
    if (!selectedKind || !geometryFromPositions(selectedKind, positions.present)) {
      setError('Cần ít nhất 2 điểm cho tuyến hoặc 3 điểm cho vùng.')
      return
    }
    setMode('view')
    setDraftReady(true)
    setDetailsOpen(true)
  }

  const addPosition = (position: Position) => {
    setPositions((current) => pushHistory(current, [...current.present, position]))
    if (mode === 'point') {
      setMode('view')
      setDraftReady(true)
      setDetailsOpen(true)
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
    setDetailsOpen(measurementKindForWork(item, props.workTypes) === 'route')
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
    setDetailsOpen(true)
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
      <section className={detailsOpen ? 'map-layout map-layout--details-open' : 'map-layout'}>
        <MeasurementLayerTree
          groups={props.groups}
          hidden={hidden}
          measurable={measurable}
          onLoadMore={(workItemId, cursor) =>
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
              )
          }
          onSelectMeasurement={selectMeasurement}
          onSelectWork={selectWork}
          onToggleWork={(id) =>
            setHidden((current) => {
              const next = new Set(current)
              if (next.has(id)) next.delete(id)
              else next.add(id)
              return next
            })
          }
          selectedId={selectedId}
          selectedWorkId={selectedWorkId}
          summaries={summaries}
          workTypes={props.workTypes}
        />

        <section className="map-stage">
          <MapQuickWorkflow
            inspectionCase={props.inspectionCase}
            mode={mode}
            onConfirm={async (measurement) => {
              try {
                const confirmed = await api.confirmMeasurement(measurement.id)
                setSelectedId(confirmed.id)
                await refreshWork(confirmed.workItemId)
              } catch (reason) {
                setError(reason instanceof Error ? reason.message : 'Không thể xác nhận phép đo.')
              }
            }}
            onError={setError}
            onOpenDetails={() => setDetailsOpen(true)}
            onSelectMeasurement={(measurement) => selectMeasurement(measurement.id)}
            onSelectWork={selectWork}
            onStart={startDrawing}
            onWorkCreated={(item) => props.onWorkCreated(item)}
            selectedWork={selectedWork}
            selectedWorkId={selectedWorkId}
            summaries={summaries}
            summary={selectedSummary}
            workItems={measurable}
            workTypes={props.workTypes}
          />
          <DrawingToolbar
            canRedo={Boolean((editHistory ?? positions).future.length)}
            canUndo={Boolean((editHistory ?? positions).past.length)}
            mode={mode}
            onCancel={() => {
              cancelDraft()
              setDetailsOpen(false)
            }}
            onFinish={finishDrawing}
            onHistory={changeHistory}
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
            Chế độ {modeLabels[mode]}. Nền {selectedBasemap.label}.
          </div>
        </section>

        {detailsOpen && (
          <MapDetailsPanel
            defaultName={defaultMeasurementName}
            draftGeometry={draftGeometry}
            draftReady={draftReady}
            facilities={facilities}
            initialCalculationInputs={initialCalculationInputs}
            measurement={selected}
            selectedKind={selectedKind}
            selectedWork={selectedWork}
            onCancel={() => {
              cancelDraft()
              setDetailsOpen(false)
            }}
            onChanged={async (measurement) => {
              cancelDraft()
              setSelectedId(measurement.id)
              await refreshWork(measurement.workItemId)
            }}
            onClose={() => setDetailsOpen(false)}
            onDataChanged={async (measurement) => {
              if (measurement) setSelectedId(measurement.id)
              if (selectedWork) await refreshWork(selectedWork.id)
            }}
            onEdit={() => {
              if (selected) {
                setEditHistory(createHistory(selected.rawGeometry))
                setMode('edit')
              }
            }}
            onError={setError}
            onRoutePreview={setRoutePreview}
            onRouteSaved={async (route) => {
              setSelectedId(route.measurement.id)
              await refreshWork(route.measurement.workItemId)
            }}
            onSaved={async (measurement, action) => {
              if (action === 'continue' && drawableKind) {
                startDrawing(drawableKind, measurement.workItemId)
                await refreshWork(measurement.workItemId)
                return
              }
              cancelDraft()
              setSelectedId(measurement.id)
              await refreshWork(measurement.workItemId)
            }}
          />
        )}
      </section>
    </main>
  )
}
