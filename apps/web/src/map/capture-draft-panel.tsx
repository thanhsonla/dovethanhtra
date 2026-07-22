import type {
  DrawableMeasurementGeometryKind,
  GeoJsonGeometry,
  ManagementZone,
} from '@dove/contracts'
import { useEffect, useState } from 'react'

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
  onQuickSave?: (name: string, zoneId: string) => void
  onSave?: () => void
  onSaveAndClassify?: () => void
  saving: boolean
  zones?: ManagementZone[]
}) {
  const [name, setName] = useState('')
  const [zoneId, setZoneId] = useState('')
  const quick = Boolean(props.onQuickSave)

  useEffect(() => {
    if (quick) setZoneId((current) => current || props.zones?.[0]?.id || '')
  }, [props.zones, quick])

  if (quick) {
    const result = temporaryValue(props.geometry).replace(/\s+(m²|m)$/u, '$1')
    return (
      <form
        className="capture-draft-panel capture-draft-panel--quick"
        onSubmit={(event) => {
          event.preventDefault()
          props.onQuickSave?.(name.trim(), zoneId)
        }}
      >
        <label>
          Tên công tác
          <input
            aria-label="Tên công tác"
            autoFocus
            maxLength={300}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nhập tên công tác"
            value={name}
          />
        </label>
        <label>
          Khu vực
          <select
            aria-label="Khu vực"
            onChange={(event) => setZoneId(event.target.value)}
            value={zoneId}
          >
            <option value="">Chọn khu vực</option>
            {(props.zones ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <div className="capture-draft-panel__result">
          <span>Số liệu · {kindLabels[props.kind]}</span>
          <strong>{result}</strong>
        </div>
        <div className="capture-draft-panel__actions">
          <button disabled={props.saving} onClick={props.onCancel} type="button">
            Hủy
          </button>
          <button
            className="primary capture-draft-panel__save"
            disabled={props.saving || !name.trim() || !zoneId}
            type="submit"
          >
            {props.saving ? 'Đang lưu…' : 'Lưu'}
          </button>
        </div>
      </form>
    )
  }

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
        <button
          className="primary"
          disabled={props.saving}
          onClick={() => props.onSave?.()}
          type="button"
        >
          {props.saving ? 'Đang lưu…' : 'Lưu nháp'}
        </button>
        <button disabled={props.saving} onClick={() => props.onSaveAndClassify?.()} type="button">
          Lưu & phân loại
        </button>
        <button disabled={props.saving} onClick={props.onCancel} type="button">
          Hủy
        </button>
      </div>
    </section>
  )
}
