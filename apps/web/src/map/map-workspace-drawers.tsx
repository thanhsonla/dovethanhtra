import type { ComponentProps } from 'react'

import { CaptureClassificationPanel } from './capture-classification-panel.js'
import { CaptureDraftPanel } from './capture-draft-panel.js'
import { MapDetailsPanel } from './map-details-panel.js'
import { MapDrawer } from './map-drawer.js'
import { MapFeatureFilterPanel } from './map-feature-filter-panel.js'
import { MapFeatureSidebar } from './map-feature-sidebar.js'
import { MapLayerPanel } from './map-layer-panel.js'
import { MapQuickWorkflow } from './map-quick-workflow.js'

type PanelName = 'capture' | 'classification' | 'data' | 'details' | 'filters' | 'layers'

export function MapWorkspaceDrawers(props: {
  activePanel: PanelName | null
  capture: ComponentProps<typeof CaptureDraftPanel> | null
  classification: ComponentProps<typeof CaptureClassificationPanel> | null
  data: ComponentProps<typeof MapQuickWorkflow>
  details: ComponentProps<typeof MapDetailsPanel>
  filters: ComponentProps<typeof MapFeatureFilterPanel>
  layers: ComponentProps<typeof MapLayerPanel>
  sidebar: ComponentProps<typeof MapFeatureSidebar> | null
  onClose: () => void
}) {
  if (!props.activePanel) return null

  if (props.activePanel === 'capture' && props.capture) {
    return (
      <MapDrawer
        id="map-capture-drawer"
        label="Lưu kết quả đo"
        onClose={props.capture.onCancel}
        side="right"
        {...(props.capture.onQuickSave ? { variant: 'compact' as const } : {})}
      >
        <CaptureDraftPanel {...props.capture} />
      </MapDrawer>
    )
  }

  if (props.activePanel === 'classification' && props.classification) {
    return (
      <MapDrawer
        id="map-classification-drawer"
        label="Phân loại kết quả đo"
        onClose={props.onClose}
        side="right"
      >
        <CaptureClassificationPanel {...props.classification} />
      </MapDrawer>
    )
  }

  if (props.activePanel === 'data') {
    return (
      <MapDrawer id="map-data-drawer" label="Quản lý số liệu" onClose={props.onClose} side="left">
        {props.sidebar && <MapFeatureSidebar {...props.sidebar} />}
        <details className="map-quick-workflow-accordion">
          <summary
            style={{ cursor: 'pointer', fontSize: '0.78rem', color: '#527063', fontWeight: 600 }}
          >
            Quản lý công tác và tiến độ hồ sơ
          </summary>
          <MapQuickWorkflow {...props.data} />
        </details>
      </MapDrawer>
    )
  }

  if (props.activePanel === 'filters') {
    return (
      <MapDrawer id="map-filter-drawer" label="Tìm kiếm dữ liệu" onClose={props.onClose}>
        <MapFeatureFilterPanel {...props.filters} />
      </MapDrawer>
    )
  }

  if (props.activePanel === 'layers') {
    return (
      <MapDrawer id="map-layers-drawer" label="Lớp bản đồ" onClose={props.onClose}>
        <MapLayerPanel {...props.layers} />
      </MapDrawer>
    )
  }

  const compactInfo =
    import.meta.env.VITE_LEGACY_CASE_DASHBOARD !== 'true' &&
    props.details.measurement &&
    !props.details.draftReady &&
    !props.details.editMode
  const compactAddition =
    props.details.compactAddition && props.details.draftReady && !props.details.editMode
  const compactSubtraction =
    Boolean(props.details.subtractionTarget) && props.details.draftReady && !props.details.editMode

  return (
    <MapDrawer
      id="map-details-drawer"
      label={
        compactSubtraction
          ? 'Lưu vùng bớt'
          : compactAddition
            ? 'Lưu phần bổ sung'
            : compactInfo
              ? 'Thông tin'
              : 'Chi tiết và nâng cao'
      }
      onClose={props.onClose}
      side="right"
      {...(compactInfo || compactAddition || compactSubtraction
        ? { variant: 'compact' as const }
        : {})}
    >
      <MapDetailsPanel {...props.details} />
    </MapDrawer>
  )
}
