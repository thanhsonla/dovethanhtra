import type { BasemapProvider } from './basemap-provider.js'
import type { FieldDisplayMode } from './map-service-colors.js'

import { MapIcon } from './map-icon.js'

export function MapWorkspaceHeader(props: {
  basemapId: string
  basemaps: BasemapProvider
  fieldMode?: FieldDisplayMode
  onBack?: () => void
  onBasemapChange(id: string): void
  onFieldModeChange?(mode: FieldDisplayMode): void
  showCommunes: boolean
  onShowCommunesChange(value: boolean): void
}) {
  const selected = props.basemaps.get(props.basemapId)
  const selectable = props.basemaps
    .descriptors()
    .filter((item) => !props.basemaps.supportsOffline(item.id))
  const fieldMode = props.fieldMode ?? 'normal'

  return (
    <header className="map-header">
      {props.onBack && (
        <button
          aria-label="Quay lại hồ sơ"
          className="map-header__back"
          onClick={props.onBack}
          title="Quay lại hồ sơ"
        >
          <span aria-hidden="true">←</span>
          <span>Hồ sơ</span>
        </button>
      )}
      <div className="map-header__controls">
        <div className="field-mode-toggle" role="group" aria-label="Chế độ hiển thị thực địa">
          <button
            type="button"
            className={`field-mode-btn ${fieldMode === 'normal' ? 'is-active' : ''}`}
            onClick={() => props.onFieldModeChange?.('normal')}
            title="Chế độ hiển thị chuẩn"
          >
            <MapIcon name="globe" /> <span>Chuẩn</span>
          </button>
          <button
            type="button"
            className={`field-mode-btn ${fieldMode === 'sun' ? 'is-active' : ''}`}
            onClick={() => props.onFieldModeChange?.('sun')}
            title="Chế độ Chói nắng ngoài thực địa (Tăng tương phản & màu Neon)"
          >
            <MapIcon name="sun" /> <span>Chói nắng</span>
          </button>
          <button
            type="button"
            className={`field-mode-btn ${fieldMode === 'night' ? 'is-active' : ''}`}
            onClick={() => props.onFieldModeChange?.('night')}
            title="Chế độ Ban đêm (Tối màu dịu mắt & màu Dạ quang)"
          >
            <MapIcon name="moon" /> <span>Đêm</span>
          </button>
        </div>

        <label className="commune-toggle" title="Hiện ranh giới và tên phường/xã">
          <input
            aria-label="Hiện ranh giới và tên phường xã"
            type="checkbox"
            checked={props.showCommunes}
            onChange={(event) => props.onShowCommunesChange(event.target.checked)}
          />
          <span>RG &amp; tên P/X</span>
        </label>
        <label className="basemap-select" title={`Bản đồ nền: ${selected.label}`}>
          <span className="basemap-select__icon">
            <MapIcon name="layers" />
          </span>
          <select
            aria-describedby="basemap-help"
            aria-label="Bản đồ nền"
            value={props.basemapId}
            onChange={(event) => {
              props.onBasemapChange(event.target.value)
              event.currentTarget.blur()
            }}
          >
            {selectable.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <small className="map-header__basemap-help" id="basemap-help">
            {selected.label}
          </small>
        </label>
      </div>
    </header>
  )
}
