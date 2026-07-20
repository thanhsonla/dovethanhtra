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
  const technical = props.basemaps.supportsOffline(props.basemapId)

  return (
    <header className="map-header">
      <button className="button button--quiet" onClick={() => props.onBack()}>
        ← Hồ sơ
      </button>
      <div>
        <p className="eyebrow">Bản đồ, hiện trường và ngoại tuyến</p>
        <h1>{props.inspectionCase.name}</h1>
      </div>
      <label className="basemap-select">
        Bản đồ nền
        <select
          aria-describedby="basemap-help"
          aria-label="Bản đồ nền"
          value={props.basemapId}
          onChange={(event) => {
            props.onBasemapChange(event.target.value)
            event.currentTarget.blur()
          }}
        >
          {props.basemaps.descriptors().map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        <small id="basemap-help">
          {technical
            ? 'Nền kỹ thuật chỉ là màu nền local để kiểm thử/fallback, không có ảnh vệ tinh hoặc địa danh.'
            : selected.label}
        </small>
      </label>
    </header>
  )
}
