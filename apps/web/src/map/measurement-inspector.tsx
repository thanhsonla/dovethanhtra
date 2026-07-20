import type {
  GeoJsonGeometry,
  Measurement,
  DrawableMeasurementGeometryKind,
  WorkItem,
} from '@dove/contracts'
import { type FormEvent, useState } from 'react'

import { api } from '../api.js'
import { calculationInputMeta, requiredInputs, temporaryValue } from './map-geometry.js'

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
  defaultName: string
  draftGeometry: GeoJsonGeometry | null
  draftReady: boolean
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

  if (props.draftReady && props.draftGeometry) {
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
  const hasErrors = measurement.warnings.some((warning) => warning.severity === 'error')
  const confirm = async () => {
    try {
      await props.onChanged(await api.confirmMeasurement(measurement.id))
    } catch (reason) {
      props.onError(reason instanceof Error ? reason.message : 'Không thể xác nhận.')
    }
  }
  const remove = async () => {
    try {
      await api.deleteMeasurement(measurement.id)
      await props.onChanged(measurement)
    } catch (reason) {
      props.onError(reason instanceof Error ? reason.message : 'Không thể xóa.')
    }
  }
  return (
    <div className="measurement-detail">
      <p className="section-kicker">Kết quả máy chủ</p>
      <h2>{measurement.name}</h2>
      <dl>
        <div>
          <dt>Giá trị cơ sở</dt>
          <dd>{measurement.baseValue?.toFixed(2) ?? 'Chưa tính'}</dd>
        </div>
        <div>
          <dt>Khối lượng</dt>
          <dd>
            {measurement.calculatedQuantity?.toFixed(2) ?? 'Thiếu đầu vào'} {measurement.unit}
          </dd>
        </div>
        <div>
          <dt>Trạng thái</dt>
          <dd>{statusLabels[measurement.status] ?? measurement.status}</dd>
        </div>
        <div>
          <dt>Quy tắc</dt>
          <dd>
            {measurement.calculationRuleCode} v{measurement.calculationVersion}
          </dd>
        </div>
      </dl>
      {measurement.warnings.length > 0 && (
        <ul className="warning-list">
          {measurement.warnings.map((warning) => (
            <li className={`warning--${warning.severity}`} key={warning.code}>
              <strong>{warning.code}</strong>
              <span>{warning.message}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="button-row">
        {['draft', 'needs_attention'].includes(measurement.status) && (
          <button className="button" disabled={hasErrors} onClick={() => void confirm()}>
            Xác nhận
          </button>
        )}
        {measurement.status === 'confirmed' && (
          <button className="button" onClick={() => props.onEdit()}>
            Hiệu chỉnh
          </button>
        )}
        <button className="button button--danger" onClick={() => void remove()}>
          Xóa mềm
        </button>
      </div>
      {measurement.status === 'confirmed' && props.draftGeometry && (
        <form className="supersede-form" onSubmit={(event) => void supersede(event)}>
          <label>
            Lý do hiệu chỉnh
            <input name="reason" minLength={3} required />
          </label>
          <button className="button" type="submit">
            Lưu phiên bản mới
          </button>
        </form>
      )}
    </div>
  )
}
