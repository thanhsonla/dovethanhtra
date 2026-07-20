import type { InspectionCase } from '@dove/contracts'

import type { BasemapProvider } from './basemap-provider.js'

export function MapWorkspaceHeader(props: {
  basemapId: string
  basemaps: BasemapProvider
  inspectionCase: InspectionCase
  onBack(): void
  onBasemapChange(id: string): void
}) {
  const selected = props.basemaps.get(props.basemapId)
  const selectable = props.basemaps
    .descriptors()
    .filter((item) => !props.basemaps.supportsOffline(item.id))

  return (
    <header className="map-header">
      <button
        aria-label="Quay lại hồ sơ"
        className="map-header__back"
        onClick={() => props.onBack()}
        title="Quay lại hồ sơ"
      >
        <span aria-hidden="true">←</span>
        <span>Hồ sơ</span>
      </button>
      <div className="map-header__title">
        <p>Bản đồ hiện trường</p>
        <h1>{props.inspectionCase.name}</h1>
      </div>
      <label className="basemap-select">
        <span>Bản đồ nền</span>
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
    </header>
  )
}
