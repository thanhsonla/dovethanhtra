import { lazy, Suspense, type ComponentProps } from 'react'

import type { CaptureDraftPanel as CaptureDraftPanelType } from './capture-draft-panel.js'
import { MapDetailsPanel } from './map-details-panel.js'
import { MapDrawer } from './map-drawer.js'
import { MapQuickWorkflow } from './map-quick-workflow.js'
import { MeasurementLayerTree } from './measurement-layer-tree.js'

type PanelName = 'capture' | 'data' | 'details' | 'filters'
const CaptureDraftPanel = lazy(async () => ({
  default: (await import('./capture-draft-panel.js')).CaptureDraftPanel,
}))

export function MapWorkspaceDrawers(props: {
  activePanel: PanelName | null
  capture: ComponentProps<typeof CaptureDraftPanelType> | null
  data: ComponentProps<typeof MapQuickWorkflow>
  details: ComponentProps<typeof MapDetailsPanel>
  filters: ComponentProps<typeof MeasurementLayerTree>
  onClose: () => void
}) {
  if (!props.activePanel) return null

  if (props.activePanel === 'capture' && props.capture) {
    return (
      <MapDrawer
        id="map-capture-drawer"
        label="Lưu kết quả đo"
        onClose={props.onClose}
        side="right"
      >
        <Suspense fallback={<p role="status">Đang mở kết quả…</p>}>
          <CaptureDraftPanel {...props.capture} />
        </Suspense>
      </MapDrawer>
    )
  }

  if (props.activePanel === 'data') {
    return (
      <MapDrawer id="map-data-drawer" label="Dữ liệu hồ sơ" onClose={props.onClose}>
        <MapQuickWorkflow {...props.data} />
      </MapDrawer>
    )
  }

  if (props.activePanel === 'filters') {
    return (
      <MapDrawer id="map-filter-drawer" label="Bộ lọc và lớp dữ liệu" onClose={props.onClose}>
        <MeasurementLayerTree {...props.filters} />
      </MapDrawer>
    )
  }

  return (
    <MapDrawer
      id="map-details-drawer"
      label="Chi tiết và nâng cao"
      onClose={props.onClose}
      side="right"
    >
      <MapDetailsPanel {...props.details} />
    </MapDrawer>
  )
}
