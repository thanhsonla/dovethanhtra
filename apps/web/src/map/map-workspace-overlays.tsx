import type { GeoJsonGeometry, MapFeature } from '@dove/contracts'

import type { StoredCaptureDraft } from '../field/offline-store.js'
import { MapCaptureStatus } from './map-capture-status.js'
import { MapFeatureCard } from './map-feature-card.js'
import { temporaryValue } from './map-geometry.js'
import type { MapMode } from './measurement-map.js'

export function MapWorkspaceOverlays(props: {
  basemapLabel: string
  capture: StoredCaptureDraft | null
  draftGeometry: GeoJsonGeometry | null
  mode: MapMode
  onClearSelection(): void
  onOpenCapture(): void
  onOpenFeature(): void
  selectedFeature: MapFeature | null
}) {
  return (
    <>
      {(props.mode === 'line' || props.mode === 'area') && (
        <output className="map-live-result" aria-label="Kết quả đo trực tiếp" aria-live="polite">
          <span>{props.mode === 'line' ? 'Tổng tuyến bổ sung' : 'Diện tích vùng bổ sung'}</span>
          <strong>{temporaryValue(props.draftGeometry)}</strong>
        </output>
      )}
      {props.selectedFeature && props.mode === 'view' && (
        <MapFeatureCard
          feature={props.selectedFeature}
          onClose={() => props.onClearSelection()}
          onOpen={() => props.onOpenFeature()}
        />
      )}
      {props.capture && props.mode === 'view' && (
        <MapCaptureStatus draft={props.capture} onOpen={() => props.onOpenCapture()} />
      )}
      <div className="map-status-sr" aria-live="polite">
        Chế độ {props.mode}. Nền {props.basemapLabel}.
      </div>
    </>
  )
}
