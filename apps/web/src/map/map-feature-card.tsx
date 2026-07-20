import type { MapFeature } from '@dove/contracts'

import { measurementBaseValue, measurementQuantity } from './measurement-summary.js'

export function MapFeatureCard(props: { feature: MapFeature; onOpen(): void; onClose(): void }) {
  const item = props.feature.measurement
  return (
    <article className="map-feature-card" aria-label="Thông tin đối tượng đã chọn">
      <button
        className="map-feature-card__close"
        aria-label="Bỏ chọn"
        onClick={() => props.onClose()}
      >
        ×
      </button>
      <span>
        {props.feature.managementZoneName ?? 'Chưa gán khu vực'} · {props.feature.serviceGroupName}
      </span>
      <strong>{item.name}</strong>
      <small>
        {props.feature.workItemName}
        {props.feature.workComponentName ? ` · ${props.feature.workComponentName}` : ''}
      </small>
      <div>
        <b>{measurementBaseValue(item)}</b>
        <b>{measurementQuantity(item)}</b>
      </div>
      <button className="map-feature-card__open" onClick={() => props.onOpen()}>
        Mở thông tin
      </button>
    </article>
  )
}
