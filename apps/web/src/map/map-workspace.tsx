import type {
  GeoJsonGeometry,
  DrawableMeasurementGeometryKind,
  InspectionCase,
  MeasurementGeometryKind,
  MeasurementListResponse,
  ServiceGroup,
  WorkItem,
  WorkType,
  TreatmentFacility,
} from '@dove/contracts'
import { useEffect, useMemo, useState } from 'react'

import { api } from '../api.js'
import { FieldPanel } from '../field/field-panel.js'
import { createBasemapProvider } from './basemap-provider.js'
import {
  createHistory,
  pushHistory,
  redoHistory,
  undoHistory,
  type HistoryState,
} from './geometry-history.js'
import { MeasurementMap, type MapMode, type Position } from './measurement-map.js'
import { geometryFromPositions, temporaryValue } from './map-geometry.js'
import { MeasurementInspector } from './measurement-inspector.js'
import { MeasurementLayerTree } from './measurement-layer-tree.js'
import { RoutePlanner } from './route-planner.js'
import { DataToolsPanel } from './data-tools-panel.js'
import { DrawingToolbar } from './drawing-toolbar.js'

const emptyPositions = createHistory<Position[]>([])
const modeLabels: Record<MapMode, string> = {
  area: 'Vẽ vùng',
  edit: 'Hiệu chỉnh',
  line: 'Vẽ tuyến',
  point: 'Vẽ điểm',
  view: 'Xem',
}
function kindForWork(item: WorkItem, workTypes: WorkType[]): MeasurementGeometryKind | null {
  const kind = workTypes.find((type) => type.id === item.workTypeId)?.measurementKind
  return kind === 'point' || kind === 'line' || kind === 'area' || kind === 'route' ? kind : null
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
    () => props.workItems.filter((item) => kindForWork(item, props.workTypes)),
    [props.workItems, props.workTypes],
  )
  const [basemaps, setBasemaps] = useState(() => createBasemapProvider())
  const [boundary, setBoundary] = useState<GeoJsonGeometry | null>(null)
  const [summaries, setSummaries] = useState<Record<string, MeasurementListResponse>>({})
  const [selectedWorkId, setSelectedWorkId] = useState(measurable[0]?.id ?? '')
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
  const selectedKind = selectedWork ? kindForWork(selectedWork, props.workTypes) : null
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

  const startDrawing = (nextMode: DrawableMeasurementGeometryKind, workItemId: string) => {
    setSelectedWorkId(workItemId)
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
    const next = pushHistory(positions, [...positions.present, position])
    setPositions(next)
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
      <header className="map-header">
        <button className="button button--quiet" onClick={() => props.onBack()}>
          ← Hồ sơ
        </button>
        <div>
          <p className="eyebrow">Mốc 4 · Bản đồ, hiện trường và ngoại tuyến</p>
          <h1>{props.inspectionCase.name}</h1>
        </div>
        <label className="basemap-select">
          Bản đồ nền
          <select value={basemapId} onChange={(event) => setBasemapId(event.target.value)}>
            {basemaps.descriptors().map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </header>
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
          onSelectWork={(item) => {
            setSelectedWorkId(item.id)
            setSelectedId(null)
            cancelDraft()
            setDetailsOpen(kindForWork(item, props.workTypes) === 'route')
          }}
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
          <DrawingToolbar
            canOpenDetails={Boolean(selectedWork)}
            canRedo={Boolean((editHistory ?? positions).future.length)}
            canUndo={Boolean((editHistory ?? positions).past.length)}
            detailsOpen={detailsOpen}
            inspectionCase={props.inspectionCase}
            mode={mode}
            onCancel={() => {
              cancelDraft()
              setDetailsOpen(false)
            }}
            onError={setError}
            onFinish={finishDrawing}
            onHistory={changeHistory}
            onStart={startDrawing}
            onToggleDetails={() => setDetailsOpen((value) => !value)}
            onWorkCreated={(item) => props.onWorkCreated(item)}
            selectedKind={selectedKind}
            selectedWorkId={selectedWorkId}
            workItems={measurable}
            workTypes={props.workTypes}
          />
          <MeasurementMap
            basemapId={basemapId}
            basemapProvider={basemaps}
            boundary={boundary}
            draftGeometry={draftGeometry}
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
          <div className="map-status-sr" aria-live="polite">
            Chế độ {modeLabels[mode]}. Kết quả tạm {temporaryValue(draftGeometry)}. Nền{' '}
            {basemaps.get(basemapId).label}.
          </div>
        </section>

        {detailsOpen && (
          <aside className="measurement-panel">
            <div className="measurement-panel__heading">
              <strong>Chi tiết phép đo</strong>
              <button onClick={() => setDetailsOpen(false)}>Đóng</button>
            </div>
            {selectedKind === 'route' && selectedWork ? (
              <RoutePlanner
                facilities={facilities}
                measurement={selected}
                workItem={selectedWork}
                onError={setError}
                onPreview={setRoutePreview}
                onSaved={async (route) => {
                  setSelectedId(route.measurement.id)
                  await refreshWork(route.measurement.workItemId)
                }}
              />
            ) : (
              <MeasurementInspector
                draftGeometry={draftGeometry}
                draftReady={draftReady}
                measurement={selected}
                selectedKind={drawableKind}
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
                onEdit={() => {
                  if (selected) {
                    setEditHistory(createHistory(selected.rawGeometry))
                    setMode('edit')
                  }
                }}
                onError={setError}
              />
            )}
            <FieldPanel
              measurement={selected}
              workItem={selectedWork}
              gpsKind={selectedKind === 'line' || selectedKind === 'point' ? selectedKind : null}
              onError={setError}
              onChanged={async (measurement) => {
                setSelectedId(measurement.id)
                await refreshWork(measurement.workItemId)
              }}
            />
            <DataToolsPanel
              allowImport={drawableKind !== null}
              onError={setError}
              workItem={selectedWork}
              onChanged={async (measurement) => {
                if (measurement) setSelectedId(measurement.id)
                if (selectedWork) await refreshWork(selectedWork.id)
              }}
            />
          </aside>
        )}
      </section>
    </main>
  )
}
