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
import { RoutePlanner } from './route-planner.js'

const basemaps = createBasemapProvider()
const emptyPositions = createHistory<Position[]>([])
const modeLabels: Record<MapMode, string> = {
  area: 'Vẽ vùng',
  edit: 'Hiệu chỉnh',
  line: 'Vẽ tuyến',
  point: 'Vẽ điểm',
  view: 'Xem',
}
const statusLabels: Record<string, string> = {
  confirmed: 'Đã xác nhận',
  draft: 'Nháp',
  needs_attention: 'Cần chú ý',
  pending_validation: 'Chờ kiểm tra',
  superseded: 'Đã thay thế',
}

function kindForWork(item: WorkItem, workTypes: WorkType[]): MeasurementGeometryKind | null {
  const kind = workTypes.find((type) => type.id === item.workTypeId)?.measurementKind
  return kind === 'point' || kind === 'line' || kind === 'area' || kind === 'route' ? kind : null
}

export function MapWorkspace(props: {
  groups: ServiceGroup[]
  inspectionCase: InspectionCase
  onBack(): void
  workItems: WorkItem[]
  workTypes: WorkType[]
}) {
  const measurable = useMemo(
    () => props.workItems.filter((item) => kindForWork(item, props.workTypes)),
    [props.workItems, props.workTypes],
  )
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
  const localFallbackId =
    basemaps.descriptors().find((item) => basemaps.supportsOffline(item.id))?.id ??
    basemaps.defaultId

  const refreshWork = async (workItemId: string) => {
    const summary = await api.listMeasurements(workItemId)
    setSummaries((current) => ({ ...current, [workItemId]: summary }))
    return summary
  }

  useEffect(() => {
    void Promise.all([
      api.getCaseMapContext(props.inspectionCase.id),
      api.listTreatmentFacilities(),
      ...measurable.map((item) => api.listMeasurements(item.id)),
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

  const startDrawing = (nextMode: DrawableMeasurementGeometryKind) => {
    if (!selectedWork || selectedKind !== nextMode) return
    setMode(nextMode)
    setPositions(createHistory([]))
    setEditHistory(null)
    setDraftReady(false)
    setRoutePreview(null)
    setSelectedId(null)
  }

  const finishDrawing = () => {
    if (!selectedKind || !geometryFromPositions(selectedKind, positions.present)) {
      setError('Cần ít nhất 2 điểm cho tuyến hoặc 3 điểm cho vùng.')
      return
    }
    setMode('view')
    setDraftReady(true)
  }

  const addPosition = (position: Position) => {
    const next = pushHistory(positions, [...positions.present, position])
    setPositions(next)
    if (mode === 'point') {
      setMode('view')
      setDraftReady(true)
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
      <section className="map-layout">
        <aside className="layer-tree">
          <p className="section-kicker">Cây lớp dữ liệu</p>
          <h2>Công tác và phép đo</h2>
          {props.groups.map((group) => {
            const groupTypeIds = new Set(
              props.workTypes
                .filter((type) => type.serviceGroupId === group.id)
                .map((type) => type.id),
            )
            const work = measurable.filter((item) => groupTypeIds.has(item.workTypeId))
            if (!work.length) return null
            return (
              <div className="layer-group" key={group.id}>
                <h3>
                  <span className="catalog-dot" style={{ background: group.color ?? '#63736c' }} />
                  {group.name}
                </h3>
                {work.map((item) => (
                  <div className="layer-work" key={item.id}>
                    <div className="layer-work__row">
                      <input
                        aria-label={`Hiển thị ${item.name}`}
                        type="checkbox"
                        checked={!hidden.has(item.id)}
                        onChange={() =>
                          setHidden((current) => {
                            const next = new Set(current)
                            if (next.has(item.id)) next.delete(item.id)
                            else next.add(item.id)
                            return next
                          })
                        }
                      />
                      <button
                        className={
                          selectedWorkId === item.id
                            ? 'layer-button layer-button--active'
                            : 'layer-button'
                        }
                        onClick={() => {
                          setSelectedWorkId(item.id)
                          setSelectedId(null)
                          cancelDraft()
                        }}
                      >
                        {item.name}
                      </button>
                    </div>
                    <ul>
                      {(summaries[item.id]?.items ?? []).map((measurement) => (
                        <li key={measurement.id}>
                          <button
                            className={
                              selectedId === measurement.id
                                ? 'measurement-link measurement-link--active'
                                : 'measurement-link'
                            }
                            onClick={() => selectMeasurement(measurement.id)}
                          >
                            <span>{measurement.name}</span>
                            <small>
                              v{measurement.version} ·{' '}
                              {statusLabels[measurement.status] ?? measurement.status}
                            </small>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )
          })}
        </aside>

        <section className="map-stage">
          <div className="map-toolbar" aria-label="Công cụ đo">
            <button disabled={selectedKind !== 'point'} onClick={() => startDrawing('point')}>
              Điểm
            </button>
            <button disabled={selectedKind !== 'line'} onClick={() => startDrawing('line')}>
              Tuyến
            </button>
            <button disabled={selectedKind !== 'area'} onClick={() => startDrawing('area')}>
              Vùng
            </button>
            {(mode === 'line' || mode === 'area') && (
              <button onClick={finishDrawing}>Kết thúc</button>
            )}
            <button
              disabled={mode === 'view' && !editHistory}
              onClick={() => changeHistory('undo')}
            >
              Hoàn tác
            </button>
            <button
              disabled={mode === 'view' && !editHistory}
              onClick={() => changeHistory('redo')}
            >
              Làm lại
            </button>
            {(mode !== 'view' || draftReady || editHistory) && (
              <button onClick={cancelDraft}>Hủy</button>
            )}
          </div>
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
              setBasemapId(localFallbackId)
              setError('Không tải được nền đã cấu hình; đã chuyển sang nền kỹ thuật local.')
            }}
            onSelect={selectMeasurement}
            selectedId={selectedId}
          />
          <div className="map-status">
            <span>Chế độ: {modeLabels[mode]}</span>
            <span>Kết quả tạm: {temporaryValue(draftGeometry)}</span>
            <span>
              Tổng đã xác nhận:{' '}
              {selectedWorkId
                ? `${summaries[selectedWorkId]?.confirmedTotal.toFixed(2) ?? '0.00'} ${summaries[selectedWorkId]?.unit ?? ''}`
                : '—'}
            </span>
            <span>Nền: {basemaps.get(basemapId).label}</span>
          </div>
        </section>

        <aside className="measurement-panel">
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
              onCancel={cancelDraft}
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
        </aside>
      </section>
    </main>
  )
}
