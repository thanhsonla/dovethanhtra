import type { DrawableMeasurementGeometryKind, GeoJsonGeometry } from '@dove/contracts'

import { temporaryValue } from './map-geometry.js'

const kindLabels: Record<DrawableMeasurementGeometryKind, string> = {
  area: 'Diện tích',
  line: 'Chiều dài',
  point: 'Điểm',
}

export function CaptureDraftPanel(props: {
  geometry: GeoJsonGeometry
  kind: DrawableMeasurementGeometryKind
  onCancel: () => void
  onSave: () => void
  saving: boolean
}) {
  return (
    <section className="capture-draft-panel">
      <p className="capture-draft-panel__eyebrow">Nháp chưa phân loại</p>
      <div className="capture-draft-panel__result">
        <span>{kindLabels[props.kind]}</span>
        <strong>{temporaryValue(props.geometry)}</strong>
      </div>
      <p>
        Lưu hình học trước. Khu vực, dịch vụ và công tác có thể bổ sung sau mà không cần đo lại.
      </p>
      <div className="form-actions">
        <button className="primary" disabled={props.saving} onClick={props.onSave} type="button">
          {props.saving ? 'Đang lưu…' : 'Lưu nháp'}
        </button>
        <button disabled={props.saving} onClick={props.onCancel} type="button">
          Hủy
        </button>
      </div>
    </section>
  )
}
