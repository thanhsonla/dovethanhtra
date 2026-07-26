import type { CSSProperties } from 'react'

import type { BasemapProvider } from './basemap-provider.js'
import type { FieldDisplayMode } from './map-service-colors.js'

import { MapIcon } from './map-icon.js'

const panelStyle: CSSProperties = { display: 'grid', gap: 12 }
const modesStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }
const modeStyle: CSSProperties = {
  display: 'grid',
  justifyItems: 'center',
  gap: 4,
  minHeight: 52,
  padding: '5px 4px',
  border: '1px solid #d4e3dc',
  borderRadius: 8,
  background: '#f8faf9',
  color: '#436356',
  fontSize: '0.68rem',
  fontWeight: 700,
}
const activeModeStyle: CSSProperties = {
  borderColor: '#176c4c',
  background: '#176c4c',
  color: '#fff',
}
const labelStyle: CSSProperties = { color: '#244d3e', fontSize: '0.78rem', fontWeight: 750 }
const selectStyle: CSSProperties = {
  width: '100%',
  minHeight: 38,
  padding: '0 8px',
  border: '1px solid #d4e3dc',
  borderRadius: 8,
  background: '#f8faf9',
  color: '#244d3e',
  font: 'inherit',
}

export function MapLayerPanel(props: {
  basemapId: string
  basemaps: BasemapProvider
  fieldMode: FieldDisplayMode
  onBasemapChange(id: string): void
  onFieldModeChange(mode: FieldDisplayMode): void
  onShowCommunesChange(value: boolean): void
  showCommunes: boolean
}) {
  const selectable = props.basemaps
    .descriptors()
    .filter((item) => !props.basemaps.supportsOffline(item.id))

  return (
    <section style={panelStyle}>
      <fieldset>
        <legend style={{ ...labelStyle, marginBottom: 7 }}>Chế độ thực địa</legend>
        <div role="group" style={modesStyle} aria-label="Chế độ hiển thị thực địa">
          {(
            [
              ['normal', 'globe', 'Chuẩn'],
              ['sun', 'sun', 'Chói nắng'],
              ['night', 'moon', 'Đêm'],
            ] as const
          ).map(([mode, icon, label]) => (
            <button
              aria-pressed={props.fieldMode === mode}
              key={mode}
              onClick={() => props.onFieldModeChange(mode)}
              style={{ ...modeStyle, ...(props.fieldMode === mode ? activeModeStyle : {}) }}
              type="button"
            >
              <MapIcon name={icon} style={{ width: 19, height: 19 }} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          color: '#244d3e',
          fontSize: '0.76rem',
        }}
      >
        <input
          checked={props.showCommunes}
          onChange={(event) => props.onShowCommunesChange(event.target.checked)}
          type="checkbox"
        />
        <span>Hiện ranh giới và tên phường/xã</span>
      </label>

      <label style={{ ...labelStyle, display: 'grid', gap: 5 }}>
        Bản đồ nền
        <select
          aria-label="Bản đồ nền trong bảng Lớp"
          onChange={(event) => props.onBasemapChange(event.target.value)}
          style={selectStyle}
          value={props.basemapId}
        >
          {selectable.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
    </section>
  )
}
