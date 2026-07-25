import type {
  GeoJsonGeometry,
  DrawableMeasurementGeometryKind,
  InspectionCase,
  ServiceGroup,
  WorkItem,
  WorkType,
} from '@dove/contracts'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

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
import type { FieldDisplayMode } from './map-service-colors.js'
import { MapAlert } from './map-alert.js'
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
  onBack?: () => void
  onWorkCreated: (item: WorkItem) => void
  onWorkChanged: (item: WorkItem) => void
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
    communeBoundaries,
    facilities,
    refreshWork,
    setBasemapId,
    summaries,
    zones,
  } = useMapWorkspaceResources(props.inspectionCase.id, measurable, setError)
  const [selectedWorkId, setSelectedWorkId] = useState(() =>
    activeWorkId(props.inspectionCase.id, measurable),
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [fieldMode, setFieldMode] = useState<FieldDisplayMode>('normal')
  const [focusVersion, setFocusVersion] = useState(0)
  const [compactAddition, setCompactAddition] = useState(false)
  const [showCommunes, setShowCommunes] = useState(true)
  const [isSnappingEnabled, setIsSnappingEnabled] = useState(true)
  const hidden = useMemo(() => new Set<string>(), [])
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
    quickSave: {
      enabled: import.meta.env.VITE_LEGACY_CASE_DASHBOARD !== 'true',
      groups: props.groups,
      onDone: async (result) => {
        const latestItems = await api.listWorkItems(props.inspectionCase.id)
        latestItems
          .filter((item) => !props.workItems.some((current) => current.id === item.id))
          .forEach(props.onWorkCreated)
        setSelectedWorkId(result.measurement.workItemId)
        setSelectedId(result.measurement.id)
        await refreshMeasurementData(result.measurement.workItemId)
      },
      workTypes: props.workTypes,
      zones,
    },
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
  const visibleMeasurements = mapFeatures.items.map((feature) => feature.measurement)
  const allMeasurements = mapFeatures.inventoryItems.map((feature) => feature.measurement)
  const selectedFeatureFromItems =
    mapFeatures.items.find((item) => item.measurement.id === selectedId) ?? null
  const selectedFeatureFromInventory =
    mapFeatures.inventoryItems.find((item) => item.measurement.id === selectedId) ?? null
  // Ref caches the last feature found for the current selectedId. It is written
  // synchronously inside selectMapFeature (before React re-renders), so it
  // survives concurrent mapFeatures.refresh() calls that temporarily empty items.
  const lastSelectedFeatureRef = useRef<typeof selectedFeatureFromItems | null>(null)
  const selectedMeasurement = selectedId
    ? (allMeasurements.find((item) => item.id === selectedId) ??
      lastSelectedFeatureRef.current?.measurement ??
      null)
    : null
  const measurementWork = selectedMeasurement
    ? (measurable.find((item) => item.id === selectedMeasurement.workItemId) ?? null)
    : null
  const cachedSelectedFeature =
    lastSelectedFeatureRef.current?.measurement.id === selectedId
      ? lastSelectedFeatureRef.current
      : null
  const selectedFeature = selectedId
    ? (selectedFeatureFromItems ??
      selectedFeatureFromInventory ??
      cachedSelectedFeature ??
      (selectedMeasurement
        ? {
            managementZoneId: null,
            managementZoneName: null,
            measurement: selectedMeasurement,
            serviceGroupId: measurementWork?.serviceGroupId ?? '',
            serviceGroupName: 'Dịch vụ công ích',
            workComponentName: null,
            workItemName: measurementWork?.name ?? 'Công tác',
          }
        : null))
    : null
  const mapMeasurements =
    selectedMeasurement && !visibleMeasurements.some((item) => item.id === selectedMeasurement.id)
      ? [...visibleMeasurements, selectedMeasurement]
      : visibleMeasurements
  const renderedMapFeatures =
    selectedFeature &&
    !mapFeatures.items.some((item) => item.measurement.id === selectedFeature.measurement.id)
      ? [...mapFeatures.items, selectedFeature]
      : mapFeatures.items
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
  const drawingKind =
    mode === 'point' || mode === 'line' || mode === 'area'
      ? mode
      : mode === 'measure'
        ? 'line'
        : null
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

  const cancelDraft = useCallback(() => {
    drawingWorkflow.cancel()
    setEditHistory(null)
    setCompactAddition(false)
  }, [drawingWorkflow])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      const activeEl = document.activeElement
      const isInput = activeEl && ['INPUT', 'SELECT', 'TEXTAREA'].includes(activeEl.tagName)

      if (isInput) {
        (activeEl as HTMLElement).blur()
      }

      if (mode !== 'view') {
        cancelDraft()
        return
      }

      if (
        selectedId ||
        mapFeatures.filters.search ||
        mapFeatures.filters.workItemId ||
        mapFeatures.filters.managementZoneId
      ) {
        setSelectedId(null)
        mapFeatures.setFilters({
          componentId: '',
          geometryKind: '',
          managementZoneId: '',
          search: '',
          serviceGroupId: '',
          status: '',
          workItemId: '',
        })
        setActivePanel(null)
      } else if (activePanel) {
        setActivePanel(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mode, cancelDraft, selectedId, mapFeatures, activePanel])

  const selectMapFeature = (id: string) => {
    if (!id) {
      setSelectedId(null)
      if (
        mapFeatures.filters.search ||
        mapFeatures.filters.workItemId ||
        mapFeatures.filters.managementZoneId
      ) {
        mapFeatures.setFilters({
          componentId: '',
          geometryKind: '',
          managementZoneId: '',
          search: '',
          serviceGroupId: '',
          status: '',
          workItemId: '',
        })
      }
      return
    }
    const feature = mapFeatures.items.find((item) => item.measurement.id === id) ?? null
    lastSelectedFeatureRef.current = feature
    setSelectedId(id)
    setFocusVersion((current) => current + 1)
    setMode('view')
    setEditHistory(null)
    clearCapture()
    setDraftReady(false)
  }

  const replaceMapFeature = (previousId: string, feature: NonNullable<typeof selectedFeature>) => {
    mapFeatures.replaceFeature(previousId, feature)
    if (selectedId === previousId) {
      lastSelectedFeatureRef.current = feature
      setSelectedId(feature.measurement.id)
    }
  }

  const selectMeasurement = (id: string) => {
    const measurement = allMeasurements.find((item) => item.id === id)
    if (!measurement) return
    setSelectedId(id)
    setFocusVersion((current) => current + 1)
    setSelectedWorkId(measurement.workItemId)
    rememberActiveWork(props.inspectionCase.id, measurement.workItemId)
    setMode('view')
    setEditHistory(null)
    clearCapture()
    setDraftReady(false)
    setActivePanel(null)
  }

  const startDrawing = (
    nextMode: DrawableMeasurementGeometryKind,
    workItemId: string,
    asCompactAddition = false,
  ) => {
    setCompactAddition(asCompactAddition)
    setSelectedWorkId(workItemId)
    rememberActiveWork(props.inspectionCase.id, workItemId)
    drawingWorkflow.start(nextMode, 'measurement')
    setEditHistory(null)
    setRoutePreview(null)
    setSelectedId(null)
  }
  const startCaptureDrawing = (nextMode: DrawableMeasurementGeometryKind | 'measure') => {
    setCompactAddition(false)
    if (nextMode === 'measure') {
      setMode('measure')
      dispatchDrawing({ type: 'reset' })
      setEditHistory(null)
      setRoutePreview(null)
      setSelectedId(null)
      return
    }
    if (!drawingWorkflow.start(nextMode, 'capture')) return
    setEditHistory(null)
    setRoutePreview(null)
    setSelectedId(null)
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

  if (!boundary) {
    return (
      <main className="map-loading" role="status">
        Đang tải không gian bản đồ…
      </main>
    )
  }

  return (
    <main className="map-shell" data-field-mode={fieldMode}>
      <MapWorkspaceHeader
        basemapId={basemapId}
        basemaps={basemaps}
        fieldMode={fieldMode}
        {...(props.onBack ? { onBack: props.onBack } : {})}
        onBasemapChange={setBasemapId}
        onFieldModeChange={setFieldMode}
        showCommunes={showCommunes}
        onShowCommunesChange={setShowCommunes}
      />
      {error && <MapAlert message={error} onClose={() => setError('')} />}
      <section className="map-layout">
        <section className="map-stage">
          <DrawingToolbar
            activePanel={activePanel}
            canDelete={drawing.selectedIndex !== null}
            canFinish={
              (mode === 'line' && drawing.history.present.length >= 2) ||
              (mode === 'measure' && drawing.history.present.length >= 2) ||
              (mode === 'area' && drawing.history.present.length >= 3)
            }
            canRedo={Boolean((editHistory ?? drawing.history).future.length)}
            canUndo={Boolean((editHistory ?? drawing.history).past.length)}
            isSnappingEnabled={isSnappingEnabled}
            mode={mode}
            onCancel={cancelDraft}
            onDelete={() => {
              dispatchDrawing({ type: 'delete-selected' })
            }}
            onFinish={drawingWorkflow.finish}
            onHistory={changeHistory}
            onOpenPanel={(panel) => setActivePanel((current) => (current === panel ? null : panel))}
            onStart={startCaptureDrawing}
            onToggleSnapping={() => setIsSnappingEnabled((prev) => !prev)}
          />
          <MeasurementMap
            basemapId={basemapId}
            basemapProvider={basemaps}
            boundary={boundary}
            communeBoundaries={communeBoundaries}
            draftGeometry={draftGeometry}
            draftPositions={draftPositions}
            draftSelectedIndex={drawing.selectedIndex}
            editMeasurement={editMeasurement}
            fieldMode={fieldMode}
            focusVersion={focusVersion}
            hiddenWorkItemIds={hidden}
            isSnappingEnabled={isSnappingEnabled}
            mapFeatures={renderedMapFeatures}
            measurements={mapMeasurements}
            mode={mode}
            onAddPosition={drawingWorkflow.addPosition}
            onEditGeometry={(geometry) =>
              setEditHistory((history) =>
                history ? pushHistory(history, geometry) : createHistory(geometry),
              )
            }
            onFinishDrawing={drawingWorkflow.finish}
            onSelectDraftVertex={(index) => dispatchDrawing({ index, type: 'select' })}
            onUpdateDraftPosition={drawingWorkflow.updatePosition}
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
            showCommunes={showCommunes}
          />
          <MapWorkspaceOverlays
            basemapLabel={selectedBasemap.label}
            capture={captureSync.latest}
            draftGeometry={draftGeometry}
            mode={mode}
            groups={props.groups}
            onAddFeature={() => {
              if (!selected || selected.geometryKind === 'route') return
              startDrawing(selected.geometryKind, selected.workItemId, true)
              setActivePanel(null)
            }}
            onClearSelection={() => setSelectedId(null)}
            onEditFeature={() => {
              if (!selected || selected.geometryKind === 'route' || selected.status !== 'confirmed')
                return
              setEditHistory(createHistory(selected.rawGeometry))
              setMode('edit')
              setActivePanel('details')
            }}
            onOpenCapture={() => classificationSelection.open(captureSync.latest!)}
            onRemoveFeature={(measurementId) => mapFeatures.removeFeature(measurementId)}
            onReplaceFeature={replaceMapFeature}
            onRefreshFeatures={async () => {
              if (selectedFeature) {
                await refreshMeasurementData(selectedFeature.measurement.workItemId)
              }
            }}
            selectedFeature={selectedFeature}
            onWorkChanged={props.onWorkChanged}
            workItem={props.workItems.find(
              (item) => item.id === selectedFeature?.measurement.workItemId,
            )}
            workMeasurements={allMeasurements.filter(
              (measurement) => measurement.workItemId === selectedFeature?.measurement.workItemId,
            )}
            workTypes={props.workTypes}
            zones={zones}
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
            compactAddition,
            defaultName: defaultMeasurementName,
            draftGeometry,
            draftReady,
            editMode: mode === 'edit',
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
              setCompactAddition(false)
              setSelectedId(measurement.id)
              await refreshMeasurementData(measurement.workItemId)
            },
          }}
          filters={{
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
          sidebar={{
            features: mapFeatures.inventoryItems.length > 0 ? mapFeatures.inventoryItems : mapFeatures.items,
            loading: mapFeatures.inventoryLoading,
            measurements: allMeasurements,
            selectedId,
            onSelect: (measurement) => selectMeasurement(measurement.id),
          }}
          onClose={() => setActivePanel(null)}
        />
      </section>
    </main>
  )
}
