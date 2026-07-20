import type {
  GeoJsonGeometry,
  DrawableMeasurementGeometryKind,
  InspectionCase,
  ServiceGroup,
  WorkItem,
  WorkType,
  WorkComponent,
} from '@dove/contracts'
import { useEffect, useMemo, useState } from 'react'

import { api } from '../api.js'
import { DrawingToolbar, type MapPanelName } from './drawing-toolbar.js'
import {
  createHistory,
  pushHistory,
  redoHistory,
  undoHistory,
  type HistoryState,
} from './geometry-history.js'
import { geometryFromPositions, positionsFromGeometry } from './map-geometry.js'
import { MapWorkspaceHeader } from './map-workspace-header.js'
import { inheritedCalculationInputs, nextMeasurementName } from './measurement-entry-defaults.js'
import { MeasurementMap } from './measurement-map.js'
import { MapWorkspaceOverlays } from './map-workspace-overlays.js'
import { activeWorkId, measurementKindForWork, rememberActiveWork } from './map-workspace-state.js'
import { MapWorkspaceDrawers } from './map-workspace-drawers.js'
import { useMapDrawingWorkflow } from './use-map-drawing-workflow.js'
import { useMapWorkspaceResources } from './use-map-workspace-resources.js'
import {
  classificationPanelProps,
  useClassificationSelection,
} from './use-capture-classification.js'
import { useMapFeatures } from './use-map-features.js'
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
  const { basemapId, basemaps, boundary, facilities, refreshWork, setBasemapId, summaries, zones } =
    useMapWorkspaceResources(props.inspectionCase.id, measurable, setError)
  const [selectedWorkId, setSelectedWorkId] = useState(() =>
    activeWorkId(props.inspectionCase.id, measurable),
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const hidden = useMemo(() => new Set<string>(), [])
  const [components, setComponents] = useState<WorkComponent[]>([])
  const [editHistory, setEditHistory] = useState<HistoryState<GeoJsonGeometry> | null>(null)
  const [routePreview, setRoutePreview] = useState<GeoJsonGeometry | null>(null)
  const [activePanel, setActivePanel] = useState<MapPanelName | null>(null)
  const classificationSelection = useClassificationSelection(setActivePanel)
  const drawingWorkflow = useMapDrawingWorkflow({
    caseId: props.inspectionCase.id,
    locked: props.inspectionCase.status === 'locked',
    onError: setError,
    onPanel: setActivePanel,
    onClassifyReady: classificationSelection.open,
  })
  const {
    capturePending,
    captureSync,
    clearCapture,
    dispatchDrawing,
    draftReady,
    drawing,
    mode,
    setDraftReady,
    setMode,
  } = drawingWorkflow
  const selectedBasemap = basemaps.get(basemapId)
  const mapFeatures = useMapFeatures(props.inspectionCase.id, setError)
  const classificationDraft = classificationSelection.find(drawingWorkflow.captureSync.drafts)
  const allMeasurements = mapFeatures.items.map((feature) => feature.measurement)
  const selectedFeature =
    mapFeatures.items.find((item) => item.measurement.id === selectedId) ?? null
  const selected = selectedFeature?.measurement ?? null
  const selectedWork = measurable.find((item) => item.id === selectedWorkId) ?? null
  const selectedSummary = selectedWork ? summaries[selectedWork.id] : undefined
  const selectedKind = selectedWork ? measurementKindForWork(selectedWork, props.workTypes) : null
  const drawableKind =
    selectedKind === 'point' || selectedKind === 'line' || selectedKind === 'area'
      ? selectedKind
      : null
  const restoredCapture = captureSync.latest
    ? {
        geometry: captureSync.latest.input.geometry,
        kind: captureSync.latest.input.geometryKind,
      }
    : null
  const visibleCapture = capturePending ?? restoredCapture
  const drawingKind = mode === 'point' || mode === 'line' || mode === 'area' ? mode : null
  const measurementDraftGeometry =
    draftReady && drawableKind ? geometryFromPositions(drawableKind, drawing.history.present) : null
  const draftGeometry =
    routePreview ??
    editHistory?.present ??
    (drawingKind ? geometryFromPositions(drawingKind, drawing.history.present) : null) ??
    measurementDraftGeometry ??
    visibleCapture?.geometry ??
    null
  const draftPositions =
    drawingKind || measurementDraftGeometry
      ? drawing.history.present
      : positionsFromGeometry(visibleCapture?.geometry ?? null)
  const editMeasurement =
    selected && editHistory ? { ...selected, rawGeometry: editHistory.present } : null
  const defaultMeasurementName = drawableKind
    ? nextMeasurementName(drawableKind, selectedSummary?.items ?? [])
    : ''
  const initialCalculationInputs = inheritedCalculationInputs(
    selectedWork,
    selectedSummary?.items ?? [],
  )

  const refreshMeasurementData = async (workItemId: string) => {
    const summary = await refreshWork(workItemId)
    await mapFeatures.refresh()
    return summary
  }

  useEffect(() => {
    if (selectedWorkId && !summaries[selectedWorkId])
      void refreshWork(selectedWorkId).catch(() => undefined)
  }, [selectedWorkId])

  useEffect(() => {
    if (!mapFeatures.filters.workItemId) {
      setComponents([])
      return
    }
    void api
      .listWorkComponents(mapFeatures.filters.workItemId)
      .then(setComponents)
      .catch(() => setComponents([]))
  }, [mapFeatures.filters.workItemId])

  const startDrawing = (nextMode: DrawableMeasurementGeometryKind, workItemId: string) => {
    setSelectedWorkId(workItemId)
    rememberActiveWork(props.inspectionCase.id, workItemId)
    drawingWorkflow.start(nextMode, 'measurement')
    setEditHistory(null)
    setRoutePreview(null)
    setSelectedId(null)
  }
  const startCaptureDrawing = (nextMode: DrawableMeasurementGeometryKind) => {
    if (!drawingWorkflow.start(nextMode, 'capture')) return
    setEditHistory(null)
    setRoutePreview(null)
    setSelectedId(null)
  }
  const cancelDraft = () => {
    drawingWorkflow.cancel()
    setEditHistory(null)
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
      dispatchDrawing({ type: direction })
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
    clearCapture()
    setDraftReady(false)
    setActivePanel('details')
  }
  const selectMapFeature = (id: string) => {
    const feature = mapFeatures.items.find((item) => item.measurement.id === id)
    if (!feature) return
    setSelectedId(id)
    setSelectedWorkId(feature.measurement.workItemId)
    rememberActiveWork(props.inspectionCase.id, feature.measurement.workItemId)
    setMode('view')
    setEditHistory(null)
    clearCapture()
    setDraftReady(false)
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
            canDelete={drawing.selectedIndex !== null}
            canFinish={
              (mode === 'line' && drawing.history.present.length >= 2) ||
              (mode === 'area' && drawing.history.present.length >= 3)
            }
            canRedo={Boolean((editHistory ?? drawing.history).future.length)}
            canUndo={Boolean((editHistory ?? drawing.history).past.length)}
            mode={mode}
            onCancel={cancelDraft}
            onDelete={() => dispatchDrawing({ type: 'delete-selected' })}
            onFinish={drawingWorkflow.finish}
            onHistory={changeHistory}
            onOpenPanel={(panel) => setActivePanel((current) => (current === panel ? null : panel))}
            onStart={startCaptureDrawing}
          />
          <MeasurementMap
            basemapId={basemapId}
            basemapProvider={basemaps}
            boundary={boundary}
            draftGeometry={draftGeometry}
            draftPositions={draftPositions}
            draftSelectedIndex={drawing.selectedIndex}
            editMeasurement={editMeasurement}
            hiddenWorkItemIds={hidden}
            measurements={allMeasurements}
            mode={mode}
            onAddPosition={drawingWorkflow.addPosition}
            onEditGeometry={(geometry) =>
              setEditHistory((history) =>
                history ? pushHistory(history, geometry) : createHistory(geometry),
              )
            }
            onFinishDrawing={drawingWorkflow.finish}
            onSelectDraftVertex={(index) => dispatchDrawing({ index, type: 'select' })}
            onBasemapFallback={() => {
              const fallbackId =
                basemapId === 'google-hybrid-upright'
                  ? 'google-hybrid-direct'
                  : 'esri-imagery-labels'
              setBasemapId(fallbackId)
              setError(
                fallbackId === 'google-hybrid-direct'
                  ? 'Không tải được lớp nhãn thẳng; đã chuyển sang Google hybrid raster.'
                  : 'Không tải được nền đã chọn; đã chuyển sang Vệ tinh + địa danh.',
              )
            }}
            onSelect={selectMapFeature}
            onViewportChange={mapFeatures.setBbox}
            selectedId={selectedId}
          />
          <MapWorkspaceOverlays
            basemapLabel={selectedBasemap.label}
            capture={captureSync.latest}
            draftGeometry={draftGeometry}
            mode={mode}
            onClearSelection={() => setSelectedId(null)}
            onOpenCapture={() => classificationSelection.open(captureSync.latest!)}
            onOpenFeature={() => setActivePanel('details')}
            selectedFeature={selectedFeature}
          />
        </section>

        <MapWorkspaceDrawers
          activePanel={activePanel}
          capture={drawingWorkflow.capturePanel}
          classification={classificationPanelProps({
            captureSync,
            clearCapture,
            draft: classificationDraft,
            onError: setError,
            onPanel: setActivePanel,
            onStart: startCaptureDrawing,
            refreshWork: refreshMeasurementData,
            selection: classificationSelection,
            setSelectedId,
            setSelectedWorkId,
            workspace: props,
          })}
          data={{
            inspectionCase: props.inspectionCase,
            mode,
            onConfirm: async (measurement) => {
              try {
                const confirmed = await api.confirmMeasurement(measurement.id)
                setSelectedId(confirmed.id)
                await refreshMeasurementData(confirmed.workItemId)
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
              await refreshMeasurementData(measurement.workItemId)
            },
            onDataChanged: async (measurement) => {
              if (measurement) setSelectedId(measurement.id)
              if (selectedWork) await refreshMeasurementData(selectedWork.id)
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
              await refreshMeasurementData(route.measurement.workItemId)
            },
            onSaved: async (measurement, action) => {
              if (action === 'continue' && drawableKind) {
                startDrawing(drawableKind, measurement.workItemId)
                await refreshMeasurementData(measurement.workItemId)
                return
              }
              cancelDraft()
              setSelectedId(measurement.id)
              await refreshMeasurementData(measurement.workItemId)
            },
          }}
          filters={{
            components,
            confirmedTotals: mapFeatures.confirmedTotals,
            filters: mapFeatures.filters,
            groups: props.groups,
            items: mapFeatures.items,
            loading: mapFeatures.loading,
            nextCursor: mapFeatures.nextCursor,
            onChange: (next) => {
              mapFeatures.setFilters(next)
              const work = measurable.find((item) => item.id === next.workItemId)
              if (work) {
                setSelectedWorkId(work.id)
                rememberActiveWork(props.inspectionCase.id, work.id)
              }
            },
            onLoadMore: () => void mapFeatures.loadMore(),
            onSelect: selectMapFeature,
            selectedId,
            workItems: measurable,
            zones,
          }}
          onClose={() => setActivePanel(null)}
        />
      </section>
    </main>
  )
}
