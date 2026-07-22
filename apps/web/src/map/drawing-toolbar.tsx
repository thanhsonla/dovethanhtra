import type { DrawableMeasurementGeometryKind } from '@dove/contracts'
import { useEffect } from 'react'

import type { MapMode } from './measurement-map.js'

export type MapPanelName = 'capture' | 'classification' | 'data' | 'details' | 'filters'
type ToolbarPanelName = Exclude<MapPanelName, 'capture' | 'classification'>

interface MapShortcutEvent {
  altKey: boolean
  ctrlKey: boolean
  key: string
  metaKey: boolean
  preventDefault(): void
  repeat: boolean
  shiftKey: boolean
  target: EventTarget | null
}

interface MapShortcutActions {
  canDelete: boolean
  canFinish: boolean
  canUndo: boolean
  onDelete(): void
  onFinish(): void
  onStart(mode: DrawableMeasurementGeometryKind): void
  onUndo(): void
}

function isTypingTarget(target: EventTarget | null) {
  const element = target as { isContentEditable?: boolean; tagName?: string } | null
  return (
    element?.isContentEditable === true ||
    element?.tagName === 'INPUT' ||
    element?.tagName === 'SELECT' ||
    element?.tagName === 'TEXTAREA'
  )
}

export function handleMapShortcut(event: MapShortcutEvent, actions: MapShortcutActions) {
  if (event.repeat || isTypingTarget(event.target)) return false
  const key = event.key.toLowerCase()
  const command = event.metaKey || event.ctrlKey

  if (command && !event.altKey && !event.shiftKey && key === 'z') {
    event.preventDefault()
    if (actions.canUndo) actions.onUndo()
    return true
  }
  if (command && !event.altKey && !event.shiftKey && key === 's') {
    event.preventDefault()
    if (actions.canFinish) actions.onFinish()
    return true
  }
  if (command || event.altKey || event.shiftKey) return false
  if (key === 'delete' || key === 'backspace') {
    event.preventDefault()
    if (actions.canDelete) actions.onDelete()
    return true
  }
  const mode = key === 'd' ? 'line' : key === 'a' ? 'area' : key === 'p' ? 'point' : null
  if (!mode) return false
  event.preventDefault()
  actions.onStart(mode)
  return true
}

function ToolIcon(props: {
  name: 'area' | 'cancel' | 'delete' | 'finish' | 'line' | 'measure' | 'point' | 'redo' | 'undo'
}) {
  const paths = {
    area: (
      <g>
        <path d="M4 20h16L4 4v16z" />
        <path d="M7 17h6L7 11v6z" />
        <path d="M4 8h2M4 12h3M4 16h2M8 20v-2M12 20v-3M16 20v-2" />
      </g>
    ),
    cancel: (
      <g>
        <circle cx="12" cy="12" r="9" />
        <path d="m15 9-6 6M9 9l6 6" />
      </g>
    ),
    delete: (
      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
    ),
    finish: (
      <g>
        <circle cx="12" cy="12" r="9" />
        <path d="m8.5 12.5 2.5 2.5 5-5" />
      </g>
    ),
    line: (
      <g>
        <path d="M21.3 6.7 17.3 2.7a2 2 0 0 0-2.8 0L2.7 14.5a2 2 0 0 0 0 2.8l4 4a2 2 0 0 0 2.8 0L21.3 9.5a2 2 0 0 0 0-2.8z" />
        <path d="m7.5 18.5 2-2M10.5 15.5l3-3M13.5 12.5l2-2M16.5 9.5l3-3" />
      </g>
    ),
    measure: (
      <g>
        <path d="M2 17h20v4H2v-4z" />
        <path d="M6 17v-2M10 17v-3M14 17v-2M18 17v-3" stroke="currentColor" strokeWidth="1.5" />
      </g>
    ),
    point: (
      <g>
        <path d="M12 21s6-5.1 6-11a6 6 0 1 0-12 0c0 5.9 6 11 6 11z" />
        <circle cx="12" cy="10" fill="currentColor" r="2.5" />
      </g>
    ),
    redo: <path d="m15 14 5-5-5-5M20 9H9.5A5.5 5.5 0 0 0 4 14.5v0A5.5 5.5 0 0 0 9.5 20H13" />,
    undo: <path d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11" />,
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      {paths[props.name]}
    </svg>
  )
}

function PanelIcon(props: { name: ToolbarPanelName }) {
  if (props.name === 'data') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path
          d="M3 6h18M3 12h18M3 18h18"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2"
        />
      </svg>
    )
  }
  if (props.name === 'filters') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <circle cx="10.5" cy="10.5" fill="none" r="6.5" />
        <path d="m15.5 15.5 4.5 4.5" fill="none" />
      </svg>
    )
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  )
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
  onStart: (mode: DrawableMeasurementGeometryKind | 'measure') => void
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      handleMapShortcut(event, {
        canDelete: props.canDelete,
        canFinish: props.canFinish,
        canUndo: props.canUndo,
        onDelete: props.onDelete,
        onFinish: props.onFinish,
        onStart: props.onStart,
        onUndo: () => props.onHistory('undo'),
      })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    props.canDelete,
    props.canFinish,
    props.canUndo,
    props.onDelete,
    props.onFinish,
    props.onHistory,
    props.onStart,
  ])

  const tools: Array<{
    kind: DrawableMeasurementGeometryKind | 'measure'
    label: string
    shortcut?: string
  }> = [
    { kind: 'point', label: 'Điểm', shortcut: 'P' },
    { kind: 'line', label: 'Chiều dài', shortcut: 'D' },
    { kind: 'area', label: 'Diện tích', shortcut: 'A' },
    { kind: 'measure', label: 'Đo nháp' },
  ]

  return (
    <div className="map-toolbar-container">
      <nav className="map-primary-toolbar" aria-label="Công cụ đo nhanh">
        {tools.map((tool) => (
          <button
            aria-label={tool.label}
            aria-keyshortcuts={tool.shortcut}
            aria-pressed={props.mode === tool.kind}
            className={props.mode === tool.kind ? 'is-active' : undefined}
            key={tool.kind}
            onClick={() => props.onStart(tool.kind)}
            title={tool.shortcut ? `${tool.label} (${tool.shortcut})` : tool.label}
            type="button"
          >
            <ToolIcon name={tool.kind} />
          </button>
        ))}
        <span className="map-primary-toolbar__separator" aria-hidden="true" />
        <button
          aria-label="Lùi điểm"
          aria-keyshortcuts="Meta+Z Control+Z"
          disabled={!props.canUndo}
          onClick={() => props.onHistory('undo')}
          title="Lùi điểm (⌘Z)"
          type="button"
        >
          <ToolIcon name="undo" />
        </button>
        <button
          aria-label="Khôi phục điểm"
          disabled={!props.canRedo}
          onClick={() => props.onHistory('redo')}
          title="Khôi phục điểm"
          type="button"
        >
          <ToolIcon name="redo" />
        </button>
        <button
          aria-label="Xóa phần đang chọn"
          aria-keyshortcuts="Delete Backspace"
          disabled={!props.canDelete}
          onClick={() => props.onDelete()}
          title="Xóa phần đang chọn (Delete)"
          type="button"
        >
          <ToolIcon name="delete" />
        </button>
        <button
          aria-label="Kết thúc phép đo"
          aria-keyshortcuts="Meta+S Control+S"
          className="map-primary-toolbar__finish"
          disabled={!props.canFinish}
          onClick={() => props.onFinish()}
          title="Lưu và kết thúc (⌘S)"
          type="button"
        >
          <ToolIcon name="finish" />
        </button>
        {props.mode !== 'view' && (
          <button
            aria-label="Hủy thao tác"
            onClick={props.onCancel}
            title="Hủy thao tác"
            type="button"
          >
            <ToolIcon name="cancel" />
          </button>
        )}
      </nav>
      <span className="map-toolbar-container__divider" aria-hidden="true" />
      <nav className="map-panel-toolbar" aria-label="Bảng điều khiển bản đồ">
        <button
          aria-controls="map-data-drawer"
          aria-expanded={props.activePanel === 'data'}
          aria-label="Quản lý số liệu"
          className={props.activePanel === 'data' ? 'is-active' : undefined}
          onClick={() => props.onOpenPanel('data')}
          title={props.activePanel === 'data' ? 'Thu gọn quản lý số liệu' : 'Mở quản lý số liệu'}
          type="button"
        >
          <PanelIcon name="data" />
        </button>
        <button
          aria-controls="map-filter-drawer"
          aria-expanded={props.activePanel === 'filters'}
          aria-label="Tìm kiếm"
          className={props.activePanel === 'filters' ? 'is-active' : undefined}
          onClick={() => props.onOpenPanel('filters')}
          title="Tìm kiếm theo tên và danh mục"
          type="button"
        >
          <PanelIcon name="filters" />
        </button>
        <button
          aria-controls="map-details-drawer"
          aria-expanded={props.activePanel === 'details'}
          aria-label="Mở nâng cao"
          className="map-status-sr"
          key="details"
          onClick={() => props.onOpenPanel('details')}
          title="Nâng cao"
          type="button"
        >
          <PanelIcon name="details" />
        </button>
      </nav>
    </div>
  )
}
