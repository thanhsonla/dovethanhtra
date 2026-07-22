import type { BasemapProvider } from './basemap-provider.js'

export function MapWorkspaceHeader(props: {
  basemapId: string
  basemaps: BasemapProvider
  onBack?: () => void
  onBasemapChange(id: string): void
  showCommunes: boolean
  onShowCommunesChange(value: boolean): void
}) {
  const selected = props.basemaps.get(props.basemapId)
  const selectable = props.basemaps
    .descriptors()
    .filter((item) => !props.basemaps.supportsOffline(item.id))

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
          <svg aria-hidden="true" className="basemap-select__icon" viewBox="0 0 24 24">
            <path d="m12 3 9 5-9 5-9-5 9-5Z" />
            <path d="m3 12 9 5 9-5M3 16l9 5 9-5" />
          </svg>
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
