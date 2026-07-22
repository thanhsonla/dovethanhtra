import type {
  GeoJsonGeometry,
  ManagementZone,
  MapFeature,
  ServiceGroup,
  WorkItem,
  WorkType,
} from '@dove/contracts'

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
  onEditFeature?: (() => void) | undefined
  onOpenCapture(): void
  onRemoveFeature?: ((measurementId: string) => void) | undefined
  onReplaceFeature?: ((previousId: string, feature: MapFeature) => void) | undefined
  onRefreshFeatures?: (() => Promise<void> | void) | undefined
  onWorkChanged?: ((item: WorkItem) => void) | undefined
  selectedFeature: MapFeature | null
  groups: ServiceGroup[]
  workItem?: WorkItem | null | undefined
  workTypes: WorkType[]
  zones: ManagementZone[]
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
          key={props.selectedFeature.measurement.id}
          feature={props.selectedFeature}
          groups={props.groups}
          onClose={() => props.onClearSelection()}
          onEdit={props.onEditFeature}
          onRemoveFeature={props.onRemoveFeature}
          onReplaceFeature={props.onReplaceFeature}
          onRefresh={props.onRefreshFeatures}
          onWorkChanged={props.onWorkChanged}
          workItem={props.workItem}
          workTypes={props.workTypes}
          zones={props.zones}
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
