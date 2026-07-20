import type {
  DrawableMeasurementGeometryKind,
  InspectionCase,
  MeasurementGeometryKind,
  MeasurementListResponse,
  WorkItem,
  WorkType,
} from '@dove/contracts'
import { type FormEvent, useState } from 'react'

import { api } from '../api.js'
import type { MapMode } from './measurement-map.js'
import { confirmedSummary } from './measurement-summary.js'

const kindLabels: Record<MeasurementGeometryKind, string> = {
  area: 'Đo diện tích',
  line: 'Đo tuyến',
  point: 'Ghi điểm',
  route: 'Lộ trình',
}

const actionLabels: Record<MeasurementGeometryKind, string> = {
  area: 'Thêm vùng',
  line: 'Thêm đoạn',
  point: 'Ghi điểm',
  route: 'Mở lộ trình',
}

function formValue(values: FormData, name: string): string {
  const value = values.get(name)
  return typeof value === 'string' ? value : ''
}

function kindOf(item: WorkItem, workTypes: WorkType[]): MeasurementGeometryKind | null {
  const kind = workTypes.find((type) => type.id === item.workTypeId)?.measurementKind
  return kind === 'point' || kind === 'line' || kind === 'area' || kind === 'route' ? kind : null
}

function supportedKind(kind: WorkType['measurementKind']): kind is MeasurementGeometryKind {
  return kind === 'point' || kind === 'line' || kind === 'area' || kind === 'route'
}

export function ActiveWorkCard(props: {
  inspectionCase: InspectionCase
  mode: MapMode
  onError(message: string): void
  onOpenDetails(): void
  onSelectWork(item: WorkItem): void
  onStart(mode: DrawableMeasurementGeometryKind, workItemId: string): void
  onWorkCreated(item: WorkItem): void
  selectedWork: WorkItem | null
  summary: MeasurementListResponse | undefined
  workItems: WorkItem[]
  workTypes: WorkType[]
}) {
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)
  const selectedKind = props.selectedWork ? kindOf(props.selectedWork, props.workTypes) : null
  const summary = confirmedSummary(props.summary)
  const drawing = props.mode === 'point' || props.mode === 'line' || props.mode === 'area'
  const creatableTypes = props.workTypes.filter(
    (item) => item.active && supportedKind(item.measurementKind),
  )

  const begin = (workItem: WorkItem, kind: MeasurementGeometryKind | null) => {
    if (!kind) return
    if (kind === 'route') props.onOpenDetails()
    else props.onStart(kind, workItem.id)
  }

  const createAndBegin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    const workTypeId = formValue(values, 'workTypeId')
    const name = formValue(values, 'name').trim()
    const workType = props.workTypes.find((item) => item.id === workTypeId)
    if (!workType || !name || !supportedKind(workType.measurementKind)) return
    setBusy(true)
    try {
      const created = await api.createWorkItem(props.inspectionCase.id, { name, workTypeId })
      props.onWorkCreated(created)
      props.onSelectWork(created)
      setCreating(false)
      begin(created, workType.measurementKind)
    } catch (reason) {
      props.onError(reason instanceof Error ? reason.message : 'Không thể tạo công tác đo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="active-work-card" aria-label="Công tác đang đo">
      <div className="active-work-card__heading">
        <span>Công tác đang đo</span>
        {selectedKind && <strong>{kindLabels[selectedKind]}</strong>}
      </div>
      {props.workItems.length > 0 ? (
        <select
          aria-label="Chọn công tác đang đo"
          value={props.selectedWork?.id ?? ''}
          onChange={(event) => {
            const selected = props.workItems.find((item) => item.id === event.target.value)
            if (selected) props.onSelectWork(selected)
            event.currentTarget.blur()
          }}
        >
          {props.workItems.map((item) => {
            const type = props.workTypes.find((candidate) => candidate.id === item.workTypeId)
            return (
              <option key={item.id} value={item.id}>
                {type?.name ?? item.workTypeCode} · {item.name}
              </option>
            )
          })}
        </select>
      ) : (
        <strong>Chưa có công tác trong hồ sơ</strong>
      )}
      {props.selectedWork && (
        <div className="active-work-card__summary" aria-label="Tổng công tác đang đo">
          <span>Tổng đã xác nhận</span>
          <strong>{summary.total}</strong>
          <small>{summary.count} bộ phận được cộng tổng</small>
        </div>
      )}
      <div className="active-work-card__actions">
        {props.selectedWork && selectedKind && (
          <button
            className="active-work-card__primary"
            disabled={drawing || props.inspectionCase.status === 'locked'}
            onClick={() => begin(props.selectedWork!, selectedKind)}
            type="button"
          >
            {drawing ? 'Đang thao tác…' : actionLabels[selectedKind]}
          </button>
        )}
        {props.selectedWork && selectedKind !== 'route' && (
          <button onClick={() => props.onOpenDetails()} type="button">
            Chi tiết
          </button>
        )}
        {props.inspectionCase.status !== 'locked' && (
          <button onClick={() => setCreating((value) => !value)} type="button">
            {creating ? 'Đóng' : 'Tạo công tác nhanh'}
          </button>
        )}
      </div>
      {creating && (
        <form className="active-work-card__create" onSubmit={(event) => void createAndBegin(event)}>
          <select aria-label="Loại công tác tạo nhanh" name="workTypeId" required defaultValue="">
            <option value="">Chọn loại công tác</option>
            {creatableTypes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <input
            aria-label="Tên công tác tạo nhanh"
            name="name"
            placeholder="Tên công tác trong hồ sơ"
            required
          />
          <button className="active-work-card__primary" disabled={busy} type="submit">
            {busy ? 'Đang tạo…' : 'Tạo và bắt đầu'}
          </button>
        </form>
      )}
    </section>
  )
}
