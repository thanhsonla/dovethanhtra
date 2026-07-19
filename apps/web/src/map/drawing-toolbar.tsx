import type {
  DrawableMeasurementGeometryKind,
  InspectionCase,
  WorkItem,
  WorkType,
} from '@dove/contracts'
import { type FormEvent, useState } from 'react'

import { api } from '../api.js'
import type { MapMode } from './measurement-map.js'

const modeLabels: Record<DrawableMeasurementGeometryKind, string> = {
  area: 'Vùng',
  line: 'Tuyến',
  point: 'Điểm',
}

function formValue(values: FormData, name: string): string {
  const value = values.get(name)
  return typeof value === 'string' ? value : ''
}

export function DrawingToolbar(props: {
  canOpenDetails: boolean
  canRedo: boolean
  canUndo: boolean
  detailsOpen: boolean
  inspectionCase: InspectionCase
  mode: MapMode
  onCancel(): void
  onError(message: string): void
  onFinish(): void
  onHistory(direction: 'undo' | 'redo'): void
  onStart(mode: DrawableMeasurementGeometryKind, workItemId: string): void
  onToggleDetails(): void
  onWorkCreated(item: WorkItem): void
  selectedKind: string | null
  selectedWorkId: string
  workItems: WorkItem[]
  workTypes: WorkType[]
}) {
  const [requestedMode, setRequestedMode] = useState<DrawableMeasurementGeometryKind | null>(null)
  const [busy, setBusy] = useState(false)

  const kindOf = (item: WorkItem) =>
    props.workTypes.find((type) => type.id === item.workTypeId)?.measurementKind
  const compatibleWork = requestedMode
    ? props.workItems.filter((item) => kindOf(item) === requestedMode)
    : []
  const compatibleTypes = requestedMode
    ? props.workTypes.filter((item) => item.active && item.measurementKind === requestedMode)
    : []

  const requestDrawing = (nextMode: DrawableMeasurementGeometryKind) => {
    const candidates = props.workItems.filter((item) => kindOf(item) === nextMode)
    if (props.selectedKind === nextMode && props.selectedWorkId) {
      props.onStart(nextMode, props.selectedWorkId)
    } else if (candidates.length === 1) {
      props.onStart(nextMode, candidates[0]!.id)
    } else {
      setRequestedMode(nextMode)
    }
  }

  const createAndStart = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!requestedMode) return
    const values = new FormData(event.currentTarget)
    const workTypeId = formValue(values, 'workTypeId')
    const name = formValue(values, 'name').trim()
    if (!workTypeId || !name) return
    setBusy(true)
    try {
      const created = await api.createWorkItem(props.inspectionCase.id, { name, workTypeId })
      props.onWorkCreated(created)
      props.onStart(requestedMode, created.id)
      setRequestedMode(null)
    } catch (reason) {
      props.onError(reason instanceof Error ? reason.message : 'Không thể tạo công tác đo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="map-toolbar" aria-label="Công cụ đo">
      {(['point', 'line', 'area'] as const).map((item) => (
        <button
          aria-pressed={props.mode === item}
          className={props.mode === item ? 'map-tool--active' : undefined}
          key={item}
          onClick={() => requestDrawing(item)}
          type="button"
        >
          {modeLabels[item]}
        </button>
      ))}
      {(props.mode === 'line' || props.mode === 'area') && (
        <button onClick={() => props.onFinish()} type="button">
          Kết thúc
        </button>
      )}
      <button disabled={!props.canUndo} onClick={() => props.onHistory('undo')} type="button">
        Hoàn tác
      </button>
      <button disabled={!props.canRedo} onClick={() => props.onHistory('redo')} type="button">
        Làm lại
      </button>
      {(props.mode !== 'view' || props.canUndo) && (
        <button onClick={() => props.onCancel()} type="button">
          Hủy
        </button>
      )}
      <button
        aria-expanded={props.detailsOpen}
        disabled={!props.canOpenDetails}
        onClick={() => props.onToggleDetails()}
        type="button"
      >
        Chi tiết
      </button>

      {requestedMode && (
        <section
          className="map-quick-work"
          aria-label={`Thiết lập đo ${modeLabels[requestedMode]}`}
        >
          <div className="map-quick-work__heading">
            <strong>Đo {modeLabels[requestedMode].toLowerCase()}</strong>
            <button onClick={() => setRequestedMode(null)} type="button">
              Đóng
            </button>
          </div>
          {compatibleWork.length > 1 ? (
            <label>
              Chọn công tác
              <select
                aria-label={`Công tác đo ${modeLabels[requestedMode].toLowerCase()}`}
                defaultValue=""
                onChange={(event) => {
                  if (!event.target.value) return
                  props.onStart(requestedMode, event.target.value)
                  setRequestedMode(null)
                }}
              >
                <option value="">Chọn để bắt đầu</option>
                {compatibleWork.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          ) : props.inspectionCase.status === 'locked' ? (
            <p>Hồ sơ đã khóa nên không thể tạo công tác mới.</p>
          ) : compatibleTypes.length ? (
            <form onSubmit={(event) => void createAndStart(event)}>
              <p>Chưa có công tác phù hợp. Tạo nhanh để bắt đầu đo:</p>
              <select aria-label="Loại công tác tạo nhanh" name="workTypeId" required>
                <option value="">Chọn loại công tác</option>
                {compatibleTypes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <input
                aria-label="Tên công tác tạo nhanh"
                name="name"
                placeholder={`Tên công tác ${modeLabels[requestedMode].toLowerCase()}`}
                required
              />
              <button disabled={busy} type="submit">
                {busy ? 'Đang tạo…' : 'Tạo và bắt đầu đo'}
              </button>
            </form>
          ) : (
            <p>Danh mục chưa có loại công tác phù hợp với phép đo này.</p>
          )}
        </section>
      )}
    </div>
  )
}
