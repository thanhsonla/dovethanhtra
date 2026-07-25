import type {
  GeoJsonGeometry,
  Measurement,
  DrawableMeasurementGeometryKind,
  WorkItem,
} from '@dove/contracts'
import { type FormEvent, useState } from 'react'

import { api } from '../api.js'
import {
  calculationInputMeta,
  polygonPerimeterMeters,
  requiredInputs,
  temporaryValue,
} from './map-geometry.js'
import { sanitizeUnit } from './measurement-summary.js'

function field(values: FormData, name: string): string {
  const value = values.get(name)
  return typeof value === 'string' ? value : ''
}

const statusLabels: Record<string, string> = {
  confirmed: 'Đã xác nhận',
  draft: 'Nháp',
  needs_attention: 'Cần chú ý',
  pending_validation: 'Chờ kiểm tra',
  superseded: 'Đã thay thế',
}

export interface MeasurementInspectorProps {
  compactAddition: boolean
  defaultName: string
  draftGeometry: GeoJsonGeometry | null
  draftReady: boolean
  editMode: boolean
  initialCalculationInputs: Record<string, number>
  measurement: Measurement | null
  onCancel(): void
  onChanged(item: Measurement): Promise<void>
  onEdit(): void
  onError(value: string): void
  onSaved(item: Measurement, action: 'continue' | 'done'): Promise<void>
  selectedKind: DrawableMeasurementGeometryKind | null
  selectedWork: WorkItem | null
}

export function MeasurementInspector(props: MeasurementInspectorProps) {
  const [busy, setBusy] = useState(false)
  const deliverSaved = async (measurement: Measurement, action: 'continue' | 'done') => {
    try {
      await props.onSaved(measurement, action)
    } catch (reason) {
      throw new Error(
        `Phép đo đã được lưu nhưng danh sách chưa tải lại: ${
          reason instanceof Error ? reason.message : 'lỗi chưa xác định'
        }`,
        { cause: reason },
      )
    }
  }

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!props.selectedWork || !props.selectedKind || !props.draftGeometry) return
    const values = new FormData(event.currentTarget)
    const submitter = (event.nativeEvent as SubmitEvent).submitter
    const action =
      submitter instanceof HTMLButtonElement && submitter.value === 'confirm'
        ? 'confirm'
        : 'continue'
    const calculationInputs = Object.fromEntries(
      requiredInputs(props.selectedWork).map((name) => [name, Number(field(values, name))]),
    )
    setBusy(true)
    try {
      const created = await api.createMeasurement(props.selectedWork.id, {
        calculationInputs,
        geometry: props.draftGeometry,
        geometryKind: props.selectedKind,
        name: field(values, 'name'),
        note: field(values, 'note') || null,
      })
      if (props.compactAddition) {
        await deliverSaved(created, 'done')
        return
      }
      if (action === 'continue') {
        await deliverSaved(created, 'continue')
        return
      }
      if (created.warnings.length > 0) {
        await deliverSaved(created, 'done')
        props.onError('Đã lưu nháp. Phép đo có cảnh báo nên cần rà soát trước khi xác nhận.')
        return
      }
      let confirmed: Measurement
      try {
        confirmed = await api.confirmMeasurement(created.id)
      } catch (reason) {
        await deliverSaved(created, 'done')
        props.onError(
          `Đã lưu nháp nhưng chưa xác nhận được: ${
            reason instanceof Error ? reason.message : 'lỗi chưa xác định'
          }`,
        )
        return
      }
      await deliverSaved(confirmed, 'done')
    } catch (reason) {
      props.onError(reason instanceof Error ? reason.message : 'Không thể lưu phép đo.')
    } finally {
      setBusy(false)
    }
  }

  const supersede = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!props.measurement || !props.draftGeometry) return
    if (props.measurement.geometryKind === 'route') return
    const values = new FormData(event.currentTarget)
    try {
      const created = await api.supersedeMeasurement(props.measurement.id, {
        calculationInputs: props.measurement.calculationInputs,
        geometry: props.draftGeometry,
        geometryKind: props.measurement.geometryKind,
        name: props.measurement.name,
        note: props.measurement.note,
        reason: field(values, 'reason'),
      })
      await props.onChanged(created)
    } catch (reason) {
      props.onError(reason instanceof Error ? reason.message : 'Không thể tạo phiên bản mới.')
    }
  }

  if (props.editMode && props.measurement && props.draftGeometry) {
    return (
      <form className="measurement-edit-save" onSubmit={(event) => void supersede(event)}>
        <div className="measurement-quick-summary">
          <span>Đang sửa hình dạng</span>
          <strong>{temporaryValue(props.draftGeometry)}</strong>
          <small>Kéo các đỉnh hoặc bấm dấu + trên bản đồ để thêm đỉnh.</small>
        </div>
        <label>
          Lý do chỉnh sửa
          <input
            autoFocus
            minLength={3}
            name="reason"
            placeholder="Ví dụ: Điều chỉnh theo kiểm tra thực địa"
            required
          />
        </label>
        <div className="measurement-save-actions">
          <button className="button button--secondary" type="submit">
            Lưu phiên bản mới
          </button>
          <button className="button button--quiet" onClick={() => props.onCancel()} type="button">
            Hủy sửa
          </button>
        </div>
      </form>
    )
  }

  if (props.draftReady && props.draftGeometry) {
    if (props.compactAddition) {
      return (
        <form
          className="measurement-form measurement-form--addition"
          onSubmit={(event) => void save(event)}
        >
          <div className="measurement-quick-summary measurement-quick-summary--addition">
            <span>Số liệu phần bổ sung</span>
            <strong>{temporaryValue(props.draftGeometry)}</strong>
          </div>
          <label>
            Tên vùng đo bổ sung
            <input autoFocus name="name" defaultValue={props.defaultName} required />
          </label>
          {requiredInputs(props.selectedWork).map((name) => (
            <input
              key={name}
              name={name}
              type="hidden"
              value={props.initialCalculationInputs[name] ?? 1}
            />
          ))}
          <button className="button" disabled={busy} type="submit">
            {busy ? 'Đang lưu…' : 'Lưu'}
          </button>
        </form>
      )
    }
    return (
      <form
        className="measurement-form measurement-form--quick"
        onSubmit={(event) => void save(event)}
      >
        <div className="measurement-quick-summary">
          <span>Kết quả tạm trên thiết bị</span>
          <strong>{temporaryValue(props.draftGeometry)}</strong>
          <small>Kết quả chính thức được máy chủ kiểm tra sau khi lưu.</small>
        </div>
        <label>
          Tên phép đo
          <input name="name" defaultValue={props.defaultName} required />
        </label>
        <div className="measurement-input-grid">
          {requiredInputs(props.selectedWork).map((name) => {
            const meta = calculationInputMeta(name)
            const inherited = props.initialCalculationInputs[name]
            return (
              <label key={name}>
                {meta.label}
                <input
                  aria-describedby={`${name}-help`}
                  defaultValue={inherited}
                  name={name}
                  placeholder={meta.placeholder}
                  type="number"
                  min="0"
                  step="any"
                  required
                />
                <small id={`${name}-help`}>
                  {inherited === undefined ? meta.description : `Kế thừa gần nhất: ${inherited}.`}
                </small>
              </label>
            )
          })}
        </div>
        <details className="measurement-more-fields">
          <summary>Ghi chú và thông tin thêm</summary>
          <label>
            Ghi chú
            <textarea name="note" rows={3} />
          </label>
          {requiredInputs(props.selectedWork).length > 0 && (
            <small>
              Các đầu vào được lưu cùng phiên bản công thức; có thể sửa giá trị kế thừa trước khi
              lưu.
            </small>
          )}
        </details>
        <div className="measurement-save-actions">
          <button
            className="button"
            disabled={busy}
            name="saveAction"
            value="continue"
            type="submit"
          >
            {busy ? 'Đang lưu…' : 'Lưu và tiếp tục'}
          </button>
          <button
            className="button button--secondary"
            disabled={busy}
            name="saveAction"
            value="confirm"
            type="submit"
          >
            Lưu và xác nhận
          </button>
          <button className="button button--quiet" type="button" onClick={() => props.onCancel()}>
            Hủy
          </button>
        </div>
      </form>
    )
  }

  if (!props.measurement) {
    return (
      <div className="empty">
        {props.selectedWork ? (
          <>
            <p>Chọn công tác rồi dùng công cụ Điểm, Tuyến hoặc Vùng.</p>
            <p>Nhấp đúp để kết thúc tuyến/vùng.</p>
          </>
        ) : (
          <>
            <p>Bản đồ đang ở chế độ xem ranh giới.</p>
            <p>Quay lại hồ sơ và thêm công tác để bắt đầu đo.</p>
          </>
        )}
      </div>
    )
  }
  const measurement = props.measurement
  const remove = async () => {
    try {
      await api.deleteMeasurement(measurement.id)
      await props.onChanged(measurement)
    } catch (reason) {
      props.onError(reason instanceof Error ? reason.message : 'Không thể xóa.')
    }
  }
  const downloadGeoJson = async () => {
    try {
      const result = await api.downloadMeasurementGeoJson(measurement.id)
      const url = URL.createObjectURL(result.blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = result.fileName
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (reason) {
      props.onError(reason instanceof Error ? reason.message : 'Không thể tải GeoJSON.')
    }
  }
  const defaultUnit =
    measurement.geometryKind === 'area'
      ? 'm²'
      : measurement.geometryKind === 'line' || measurement.geometryKind === 'route'
        ? 'm'
        : 'điểm'
  const cleanUnit = sanitizeUnit(measurement.unit) || defaultUnit

  const perimeterM =
    measurement.geometryKind === 'area'
      ? polygonPerimeterMeters(measurement.normalizedGeometry ?? measurement.rawGeometry)
      : null

  const formattedTime = new Date(measurement.createdAt).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const valueText = measurement.baseValue
    ? `${measurement.baseValue.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cleanUnit}`
    : `0.00 ${cleanUnit}`

  return (
    <div className="measurement-detail">
      <div className="measurement-detail__header">
        <span className="measurement-detail__kicker">Nội dung công việc</span>
        <h2>{measurement.name}</h2>
        <p className="measurement-detail__time">
          Thời gian lập: {formattedTime} · v{measurement.version} ·{' '}
          {statusLabels[measurement.status] ?? measurement.status}
        </p>
      </div>
      <div className="measurement-detail__metric">
        <span className="measurement-detail__metric-label">Giá trị ({cleanUnit})</span>
        <strong className="measurement-detail__metric-value">{valueText}</strong>
        {perimeterM != null && (
          <div
            className="measurement-detail__perimeter-info"
            style={{ marginTop: '6px', fontSize: '0.85rem', color: '#475569' }}
          >
            Chu vi:{' '}
            <strong>
              {perimeterM.toLocaleString('vi-VN', {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}{' '}
              m
            </strong>
          </div>
        )}
      </div>
      <div className="button-row">
        <button className="button button--quiet" onClick={() => void downloadGeoJson()}>
          Tải GeoJSON
        </button>
        <button className="button button--danger" onClick={() => void remove()}>
          Xóa
        </button>
      </div>
    </div>
  )
}
