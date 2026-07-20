import type { DrawableMeasurementGeometryKind } from '@dove/contracts'

import type { MapMode } from './measurement-map.js'

export type MapPanelName = 'capture' | 'data' | 'details' | 'filters'
type ToolbarPanelName = Exclude<MapPanelName, 'capture'>

function ToolIcon(props: {
  name: 'area' | 'cancel' | 'delete' | 'finish' | 'line' | 'point' | 'redo' | 'undo'
}) {
  const paths = {
    area: <path d="M5 18 9 5l10 4-3 10Z" />,
    cancel: <path d="m7 7 10 10M17 7 7 17" />,
    delete: <path d="M6 7h12m-10 0 1 12h6l1-12m-6-3h4" />,
    finish: <path d="m5 12 4 4L19 6" />,
    line: <path d="M5 17 10 7l9 8M5 17h.01M10 7h.01M19 15h.01" />,
    point: (
      <path d="M12 21s6-5.1 6-11a6 6 0 1 0-12 0c0 5.9 6 11 6 11Zm0-8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
    ),
    redo: <path d="m15 7 4 4-4 4m4-4h-8a6 6 0 0 0-6 6" />,
    undo: <path d="m9 7-4 4 4 4m-4-4h8a6 6 0 0 1 6 6" />,
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      {paths[props.name]}
    </svg>
  )
}

function PanelIcon(props: { name: ToolbarPanelName }) {
  if (props.name === 'data') {
    return <span aria-hidden="true">☰</span>
  }
  if (props.name === 'filters') {
    return <span aria-hidden="true">⌕</span>
  }
  return <span aria-hidden="true">•••</span>
}

export function DrawingToolbar(props: {
  activePanel: MapPanelName | null
  canDelete: boolean
  canFinish: boolean
  canRedo: boolean
  canUndo: boolean
  mode: MapMode
  onCancel: () => void
  onDelete: () => void
  onFinish: () => void
  onHistory: (direction: 'undo' | 'redo') => void
  onOpenPanel: (panel: ToolbarPanelName) => void
  onStart: (mode: DrawableMeasurementGeometryKind) => void
}) {
  const tools: Array<{ kind: DrawableMeasurementGeometryKind; label: string }> = [
    { kind: 'point', label: 'Điểm' },
    { kind: 'line', label: 'Chiều dài' },
    { kind: 'area', label: 'Diện tích' },
  ]

  return (
    <>
      <nav className="map-primary-toolbar" aria-label="Công cụ đo nhanh">
        {tools.map((tool) => (
          <button
            aria-pressed={props.mode === tool.kind}
            className={props.mode === tool.kind ? 'is-active' : undefined}
            key={tool.kind}
            onClick={() => props.onStart(tool.kind)}
            title={tool.label}
            type="button"
          >
            <ToolIcon name={tool.kind} />
            <span>{tool.label}</span>
          </button>
        ))}
        <span className="map-primary-toolbar__separator" aria-hidden="true" />
        <button
          aria-label="Lùi điểm"
          disabled={!props.canUndo}
          onClick={() => props.onHistory('undo')}
          title="Lùi điểm"
          type="button"
        >
          <ToolIcon name="undo" />
          <span>Lùi</span>
        </button>
        <button
          aria-label="Khôi phục điểm"
          disabled={!props.canRedo}
          onClick={() => props.onHistory('redo')}
          title="Khôi phục điểm"
          type="button"
        >
          <ToolIcon name="redo" />
          <span>Tiến</span>
        </button>
        <button
          aria-label="Xóa phần đang chọn"
          disabled={!props.canDelete}
          onClick={() => props.onDelete()}
          title="Xóa phần đang chọn"
          type="button"
        >
          <ToolIcon name="delete" />
          <span>Xóa</span>
        </button>
        <button
          aria-label="Kết thúc phép đo"
          className="map-primary-toolbar__finish"
          disabled={!props.canFinish}
          onClick={() => props.onFinish()}
          title="Kết thúc phép đo"
          type="button"
        >
          <ToolIcon name="finish" />
          <span>Kết thúc</span>
        </button>
        {props.mode !== 'view' && (
          <button
            aria-label="Hủy thao tác"
            onClick={props.onCancel}
            title="Hủy thao tác"
            type="button"
          >
            <ToolIcon name="cancel" />
            <span>Hủy</span>
          </button>
        )}
      </nav>
      <nav className="map-panel-toolbar" aria-label="Bảng điều khiển bản đồ">
        {(['data', 'filters', 'details'] as const).map((panel) => {
          const label = { data: 'Dữ liệu', details: 'Nâng cao', filters: 'Bộ lọc' }[panel]
          const panelId = {
            data: 'map-data-drawer',
            details: 'map-details-drawer',
            filters: 'map-filter-drawer',
          }[panel]
          return (
            <button
              aria-controls={panelId}
              aria-expanded={props.activePanel === panel}
              aria-label={`Mở ${label.toLocaleLowerCase('vi')}`}
              className={props.activePanel === panel ? 'is-active' : undefined}
              key={panel}
              onClick={() => props.onOpenPanel(panel)}
              title={label}
              type="button"
            >
              <PanelIcon name={panel} />
              <span>{label}</span>
            </button>
          )
        })}
      </nav>
    </>
  )
}
