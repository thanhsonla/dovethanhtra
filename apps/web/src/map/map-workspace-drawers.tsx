import type { ComponentProps } from 'react'

import { MapDetailsPanel } from './map-details-panel.js'
import { MapDrawer } from './map-drawer.js'
import { MapQuickWorkflow } from './map-quick-workflow.js'
import { MeasurementLayerTree } from './measurement-layer-tree.js'

type PanelName = 'data' | 'details' | 'filters'

export function MapWorkspaceDrawers(props: {
  activePanel: PanelName | null
  data: ComponentProps<typeof MapQuickWorkflow>
  details: ComponentProps<typeof MapDetailsPanel>
  filters: ComponentProps<typeof MeasurementLayerTree>
  onClose: () => void
}) {
  if (!props.activePanel) return null

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
