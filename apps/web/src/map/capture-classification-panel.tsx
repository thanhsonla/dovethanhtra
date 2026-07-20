import type {
  ClassifyCaptureDraftRequest,
  ClassifyCaptureDraftResponse,
  ManagementZone,
  ServiceGroup,
  WorkComponent,
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
  const [components, setComponents] = useState<WorkComponent[]>([])
  const [componentId, setComponentId] = useState('')
  const [componentName, setComponentName] = useState('')
  const [measurementName, setMeasurementName] = useState(() => defaultMeasurementName(props.draft))
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ClassifyCaptureDraftResponse | null>(null)
  const [continueRequested, setContinueRequested] = useState(false)
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
    setComponents([])
    if (workItemId === 'new') return
    void api
      .listWorkComponents(workItemId)
      .then(setComponents)
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : 'Không tải được mục con.'),
      )
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
      setResult(response)
      setContinueRequested(continueDrawing)
      if (!response.measurement.warnings.length) await props.onDone(response, continueDrawing)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể phân loại nháp.')
    } finally {
      setBusy(false)
    }
  }

  if (result) {
    return (
      <section className="capture-classification capture-classification--result">
        <p className="capture-classification__eyebrow">Kết quả máy chủ</p>
        <h3>{result.measurement.name}</h3>
        <strong>
          {result.measurement.calculatedQuantity ?? 'Chưa tính được'} {result.measurement.unit}
        </strong>
        {result.measurement.warnings.map((warning) => (
          <div className="alert" key={warning.code} role="alert">
            {warning.message}
          </div>
        ))}
        <p>Geometry đã được giữ nguyên; phép đo cần xử lý cảnh báo trước khi xác nhận.</p>
        <div className="form-actions">
          <button
            className="primary"
            onClick={() => void props.onDone(result, continueRequested)}
            type="button"
          >
            {continueRequested ? 'Tiếp tục đo' : 'Đóng'}
          </button>
        </div>
      </section>
    )
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
      <label>
        Lĩnh vực dịch vụ
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
      <label>
        Công tác
        <select
          aria-label="Công tác khi phân loại"
          onChange={(event) => setWorkItemId(event.target.value)}
          value={workItemId}
        >
          <option value="new">＋ Tạo công tác mới</option>
          {workItems.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      {workItemId === 'new' && (
        <>
          <label>
            Tên công tác
            <input
              aria-label="Tên công tác khi phân loại"
              maxLength={300}
              onChange={(event) => setWorkItemName(event.target.value)}
              placeholder="Ví dụ: Chiều dài đường"
              value={workItemName}
            />
          </label>
          {!workTypes.length && (
            <p className="field-hint is-error">
              Lĩnh vực này chưa có quy tắc{' '}
              {kindLabels[props.draft.input.geometryKind].toLowerCase()}. Hãy chọn lĩnh vực khác
              hoặc thêm quy tắc trong danh mục.
            </p>
          )}
          {workTypes.length > 1 && (
            <details>
              <summary>Quy tắc tính nâng cao</summary>
              <label>
                Quy tắc
                <select
                  aria-label="Quy tắc tính khi phân loại"
                  onChange={(event) => setWorkTypeId(event.target.value)}
                  value={workTypeId}
                >
                  {workTypes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            </details>
          )}
        </>
      )}
      <label>
        Mục con (không bắt buộc)
        <select
          aria-label="Mục con khi phân loại"
          onChange={(event) => setComponentId(event.target.value)}
          value={componentId}
        >
          <option value="">Không dùng mục con</option>
          <option value="new">＋ Tạo mục con mới</option>
          {components.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      {componentId === 'new' && (
        <label>
          Tên mục con
          <input
            aria-label="Tên mục con khi phân loại"
            maxLength={300}
            onChange={(event) => setComponentName(event.target.value)}
            placeholder="Ví dụ: Đường Trần Đăng Ninh"
            value={componentName}
          />
        </label>
      )}
      <label>
        Tên phép đo
        <input
          aria-label="Tên phép đo khi phân loại"
          maxLength={300}
          onChange={(event) => setMeasurementName(event.target.value)}
          value={measurementName}
        />
      </label>
      <details>
        <summary>Ghi chú</summary>
        <textarea
          aria-label="Ghi chú khi phân loại"
          maxLength={5000}
          onChange={(event) => setNote(event.target.value)}
          value={note}
        />
      </details>
      <p className="capture-classification__hint">
        Kết quả chính thức do máy chủ kiểm tra geometry và tính bằng PostGIS khi lưu.
      </p>
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
