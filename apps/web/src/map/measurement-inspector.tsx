import type {
  GeoJsonGeometry,
  Measurement,
  DrawableMeasurementGeometryKind,
  WorkItem,
} from '@dove/contracts'
import { type FormEvent } from 'react'

import { api } from '../api.js'
import { requiredInputs, temporaryValue } from './map-geometry.js'

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
  draftGeometry: GeoJsonGeometry | null
  draftReady: boolean
  measurement: Measurement | null
  onCancel(): void
  onChanged(item: Measurement): Promise<void>
  onEdit(): void
  onError(value: string): void
  selectedKind: DrawableMeasurementGeometryKind | null
  selectedWork: WorkItem | null
}

export function MeasurementInspector(props: MeasurementInspectorProps) {
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!props.selectedWork || !props.selectedKind || !props.draftGeometry) return
    const values = new FormData(event.currentTarget)
    const calculationInputs = Object.fromEntries(
      requiredInputs(props.selectedWork).map((name) => [name, Number(field(values, name))]),
    )
    try {
      const created = await api.createMeasurement(props.selectedWork.id, {
        calculationInputs,
        geometry: props.draftGeometry,
        geometryKind: props.selectedKind,
        name: field(values, 'name'),
        note: field(values, 'note') || null,
      })
      await props.onChanged(created)
    } catch (reason) {
      props.onError(reason instanceof Error ? reason.message : 'Không thể lưu phép đo.')
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
      <form className="measurement-form" onSubmit={(event) => void save(event)}>
        <p className="section-kicker">Phép đo mới</p>
        <h2>Kết quả tạm: {temporaryValue(props.draftGeometry)}</h2>
        <label>
          Tên phép đo
          <input name="name" required />
        </label>
        {requiredInputs(props.selectedWork).map((name) => (
          <label key={name}>
            {name}
            <input name={name} type="number" min="0" step="any" required />
          </label>
        ))}
        <label>
          Ghi chú
          <textarea name="note" rows={3} />
        </label>
        <div className="button-row">
          <button className="button" type="submit">
            Lưu và tính máy chủ
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
        <p>Chọn công tác rồi dùng công cụ Điểm, Tuyến hoặc Vùng.</p>
        <p>Nhấp đúp để kết thúc tuyến/vùng.</p>
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
