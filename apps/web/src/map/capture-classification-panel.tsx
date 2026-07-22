import type {
  ClassifyCaptureDraftRequest,
  ClassifyCaptureDraftResponse,
  ManagementZone,
  ServiceGroup,
  WorkItem,
  WorkType,
} from '@dove/contracts'
import { useEffect, useMemo, useState } from 'react'

import { api } from '../api.js'
import type { StoredCaptureDraft } from '../field/offline-store.js'
import {
  classificationPayload,
  compatibleWorkItems,
  compatibleWorkTypes,
} from './capture-classification-options.js'
import { temporaryValue } from './map-geometry.js'

const kindLabels = { area: 'Diện tích', line: 'Chiều dài', point: 'Điểm' } as const

function defaultMeasurementName(draft: StoredCaptureDraft) {
  const now = new Date()
  return `${kindLabels[draft.input.geometryKind]} ${now.toLocaleDateString('vi-VN')} ${now
    .toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    .replace(':', 'h')}`
}

export function CaptureClassificationPanel(props: {
  draft: StoredCaptureDraft
  groups: ServiceGroup[]
  onDone: (result: ClassifyCaptureDraftResponse, continueDrawing: boolean) => Promise<void>
  onReload: () => Promise<void>
  onSubmit: (
    input: ClassifyCaptureDraftRequest,
    key: string,
  ) => Promise<ClassifyCaptureDraftResponse>
  workItems: WorkItem[]
  workTypes: WorkType[]
}) {
  const [zones, setZones] = useState<ManagementZone[]>([])
  const [zoneId, setZoneId] = useState('')
  const [groupId, setGroupId] = useState('')
  const [workItemId, setWorkItemId] = useState('new')
  const [workItemName, setWorkItemName] = useState('')
  const [workTypeId, setWorkTypeId] = useState('')
  const [componentId, setComponentId] = useState('')
  const [componentName, setComponentName] = useState('')
  const [measurementName, setMeasurementName] = useState(() => defaultMeasurementName(props.draft))
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [key, setKey] = useState(() => `classify-${crypto.randomUUID()}`)
  const [attempted, setAttempted] = useState(false)

  useEffect(() => {
    void api
      .listManagementZones()
      .then((items) => {
        setZones(items)
        setZoneId((current) => current || items[0]?.id || '')
      })
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : 'Không tải được khu vực.'),
      )
  }, [])

  useEffect(() => {
    if (!groupId)
      setGroupId(props.groups.find((item) => item.quickDefault)?.id ?? props.groups[0]?.id ?? '')
  }, [groupId, props.groups])

  const workTypes = useMemo(
    () => compatibleWorkTypes(props.workTypes, groupId, props.draft.input.geometryKind),
    [groupId, props.draft.input.geometryKind, props.workTypes],
  )
  const workItems = useMemo(
    () => compatibleWorkItems(props.workItems, zoneId, groupId, props.draft.input.geometryKind),
    [groupId, props.draft.input.geometryKind, props.workItems, zoneId],
  )

  useEffect(
    () =>
      setWorkTypeId((current) =>
        workTypes.some((item) => item.id === current) ? current : (workTypes[0]?.id ?? ''),
      ),
    [workTypes],
  )

  useEffect(() => {
    setComponentId('')
  }, [workItemId])

  const valid =
    Boolean(zoneId && groupId && measurementName.trim()) &&
    (workItemId === 'new' ? Boolean(workItemName.trim() && workTypeId) : Boolean(workItemId)) &&
    (componentId !== 'new' || Boolean(componentName.trim()))

  const submit = async (continueDrawing: boolean) => {
    if (!valid) return
    setBusy(true)
    setAttempted(true)
    setError('')
    try {
      const response = await props.onSubmit(
        classificationPayload({
          componentId,
          componentName,
          measurementName,
          note,
          workItemId,
          workItemName,
          workTypeId,
          zoneId,
        }),
        key,
      )
      await props.onDone(response, continueDrawing)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể phân loại nháp.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="capture-classification"
      onChange={() => {
        if (!attempted) return
        setAttempted(false)
        setKey(`classify-${crypto.randomUUID()}`)
      }}
      onSubmit={(event) => {
        event.preventDefault()
        void submit(false)
      }}
    >
      <div className="capture-draft-panel__result">
        <span>{kindLabels[props.draft.input.geometryKind]} tạm tính</span>
        <strong>{temporaryValue(props.draft.input.geometry)}</strong>
      </div>
      {error && (
        <div className="alert" role="alert">
          {error}
        </div>
      )}
      {props.draft.status === 'conflict' && (
        <button
          className="button button--quiet"
          onClick={() =>
            void props.onReload().then(() => setKey(`classify-${crypto.randomUUID()}`))
          }
          type="button"
        >
          Tải lại phiên bản máy chủ
        </button>
      )}
      {/* 1. Khu vực quản lý */}
      <label>
        Khu vực quản lý
        <select
          aria-label="Khu vực quản lý khi phân loại"
          onChange={(event) => {
            setZoneId(event.target.value)
            setWorkItemId('new')
          }}
          value={zoneId}
        >
          <option value="">Chọn khu vực</option>
          {zones.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>

      {/* 2. Loại dịch vụ */}
      <label>
        Loại dịch vụ
        <select
          aria-label="Lĩnh vực dịch vụ khi phân loại"
          onChange={(event) => {
            setGroupId(event.target.value)
            setWorkItemId('new')
          }}
          value={groupId}
        >
          <option value="">Chọn lĩnh vực</option>
          {props.groups.map((item) => (
            <option key={item.id} value={item.id}>
              {item.quickLabel ?? item.name}
            </option>
          ))}
        </select>
      </label>

      {/* 3. Tên công tác */}
      <select
        aria-label="Công tác khi phân loại"
        onChange={(event) => setWorkItemId(event.target.value)}
        style={{ display: 'none' }}
        value={workItemId}
      >
        <option value="new">＋ Tạo công tác mới</option>
        {workItems.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
      <label>
        Tên công tác
        <input
          aria-label="Tên công tác khi phân loại"
          maxLength={300}
          onChange={(event) => {
            const val = event.target.value
            setWorkItemName(val)
            if (!measurementName || measurementName === defaultMeasurementName(props.draft)) {
              setMeasurementName(val)
            }
          }}
          placeholder="Ví dụ: Chiều dài đường"
          value={workItemName}
        />
      </label>

      {/* Hidden inputs for optional component/measurement name compatibility */}
      <select
        aria-label="Mục con khi phân loại"
        className="map-status-sr"
        id="classified-component-select"
        onChange={(event) => setComponentId(event.target.value)}
        value={componentId}
      >
        <option value="">Không dùng mục con</option>
        <option value="new">＋ Tạo mục con mới</option>
      </select>

      {componentId === 'new' && (
        <input
          aria-label="Tên mục con khi phân loại"
          className="map-status-sr"
          id="classified-component-name-input"
          onChange={(event) => setComponentName(event.target.value)}
          value={componentName}
        />
      )}

      <input
        aria-label="Tên phép đo khi phân loại"
        className="map-status-sr"
        id="classified-measurement-name-input"
        onChange={(event) => setMeasurementName(event.target.value)}
        value={measurementName}
      />

      {/* 4. Ghi chú */}
      <label>
        Ghi chú
        <textarea
          aria-label="Ghi chú khi phân loại"
          maxLength={5000}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Nhập ghi chú hiện trường (không bắt buộc)..."
          rows={3}
          value={note}
        />
      </label>

      <div className="form-actions">
        <button className="primary" disabled={!valid || busy} type="submit">
          {busy ? 'Đang lưu…' : 'Lưu'}
        </button>
        <button disabled={!valid || busy} onClick={() => void submit(true)} type="button">
          Lưu & tiếp tục đo
        </button>
      </div>
    </form>
  )
}
