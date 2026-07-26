import type { DrawableMeasurementGeometryKind } from '@dove/contracts'
import { useEffect, useState } from 'react'

import { MapIcon, type MapIconName } from './map-icon.js'
import type { MapMode } from './measurement-map.js'

export type MapPanelName = 'capture' | 'classification' | 'data' | 'details' | 'filters' | 'layers'
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

const panelIcons: Record<ToolbarPanelName, MapIconName> = {
  data: 'data',
  details: 'settings',
  filters: 'search',
  layers: 'layers',
}

export function DrawingToolbar(props: {
  activePanel: MapPanelName | null
  canDelete: boolean
  canFinish: boolean
  canRedo: boolean
  canUndo: boolean
  isMagnifierEnabled?: boolean
  isSnappingEnabled?: boolean
  mode: MapMode
  onCancel: () => void
  onDelete: () => void
  onFinish: () => void
  onHistory: (direction: 'undo' | 'redo') => void
  onOpenPanel: (panel: ToolbarPanelName) => void
  onStart: (mode: DrawableMeasurementGeometryKind | 'measure') => void
  onToggleMagnifier?: () => void
  onToggleSnapping?: () => void
}) {
  const [moreOpen, setMoreOpen] = useState(false)
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
    kind: DrawableMeasurementGeometryKind
    label: string
    shortcut?: string
  }> = [
    { kind: 'point', label: 'Điểm', shortcut: 'P' },
    { kind: 'line', label: 'Chiều dài', shortcut: 'D' },
    { kind: 'area', label: 'Diện tích', shortcut: 'A' },
  ]
  const isDrawing = props.mode !== 'view'
  const modeLabel =
    props.mode === 'point'
      ? 'Đang vẽ điểm'
      : props.mode === 'line' || props.mode === 'measure'
        ? 'Đang vẽ tuyến'
        : props.mode === 'area'
          ? 'Đang vẽ vùng'
          : 'Đang sửa hình dạng'

  const openPanel = (panel: ToolbarPanelName) => {
    setMoreOpen(false)
    props.onOpenPanel(panel)
  }

  return (
    <div className={`map-toolbar-container${isDrawing ? ' map-toolbar-container--drawing' : ''}`}>
      <nav className="map-primary-toolbar" aria-label="Công cụ đo nhanh">
        {isDrawing ? (
          <>
            <output className="map-toolbar-mode" aria-live="polite">
              {modeLabel}
            </output>
            <button
              aria-label={props.isSnappingEnabled !== false ? 'Tắt bắt điểm' : 'Bật bắt điểm'}
              aria-pressed={props.isSnappingEnabled !== false}
              className={props.isSnappingEnabled !== false ? 'is-active' : undefined}
              onClick={() => props.onToggleSnapping?.()}
              title="Bắt điểm"
              type="button"
            >
              <MapIcon name="snap" />
            </button>
            <button
              aria-label="Lùi điểm"
              aria-keyshortcuts="Meta+Z Control+Z"
              disabled={!props.canUndo}
              onClick={() => props.onHistory('undo')}
              title="Lùi điểm (⌘Z)"
              type="button"
            >
              <MapIcon name="undo" />
            </button>
            <button
              aria-label="Khôi phục điểm"
              disabled={!props.canRedo}
              onClick={() => props.onHistory('redo')}
              title="Khôi phục điểm"
              type="button"
            >
              <MapIcon name="redo" />
            </button>
            <button
              aria-label="Xóa phần đang chọn"
              aria-keyshortcuts="Delete Backspace"
              disabled={!props.canDelete}
              onClick={() => props.onDelete()}
              title="Xóa phần đang chọn (Delete)"
              type="button"
            >
              <MapIcon name="delete" />
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
              <MapIcon name="finish" />
            </button>
            <button
              aria-label="Hủy thao tác"
              className="map-primary-toolbar__cancel"
              onClick={props.onCancel}
              title="Hủy thao tác"
              type="button"
            >
              <MapIcon name="cancel" />
            </button>
          </>
        ) : (
          tools.map((tool) => (
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
              <MapIcon name={tool.kind} />
            </button>
          ))
        )}
      </nav>
      {!isDrawing && (
        <>
          <span className="map-toolbar-container__divider" aria-hidden="true" />
          <nav className="map-panel-toolbar" aria-label="Bảng điều khiển bản đồ">
            {(['data', 'filters', 'layers'] as const).map((panel) => (
              <button
                aria-controls={`map-${panel === 'filters' ? 'filter' : panel}-drawer`}
                aria-expanded={props.activePanel === panel}
                aria-label={
                  panel === 'data'
                    ? 'Quản lý số liệu'
                    : panel === 'filters'
                      ? 'Tìm kiếm'
                      : 'Lớp bản đồ'
                }
                className={props.activePanel === panel ? 'is-active' : undefined}
                key={panel}
                onClick={() => openPanel(panel)}
                title={
                  panel === 'data'
                    ? 'Quản lý số liệu'
                    : panel === 'filters'
                      ? 'Tìm kiếm'
                      : 'Lớp bản đồ'
                }
                type="button"
              >
                <MapIcon name={panelIcons[panel]} />
              </button>
            ))}
          </nav>
        </>
      )}
      <div className="map-toolbar-more">
        <button
          aria-expanded={moreOpen}
          aria-haspopup="menu"
          aria-label="Thêm công cụ"
          className={moreOpen ? 'is-active' : undefined}
          onClick={() => setMoreOpen((open) => !open)}
          title="Thêm công cụ"
          type="button"
        >
          <MapIcon name="more" />
        </button>
        {moreOpen && (
          <div className="map-toolbar-more__menu" role="menu">
            <button
              aria-checked={props.isMagnifierEnabled}
              onClick={() => props.onToggleMagnifier?.()}
              role="menuitemcheckbox"
              type="button"
            >
              <MapIcon name="magnifier" />
              <span>{props.isMagnifierEnabled ? 'Tắt kính lúp 2x' : 'Bật kính lúp 2x'}</span>
            </button>
            <button onClick={() => openPanel('details')} role="menuitem" type="button">
              <MapIcon name="settings" />
              <span>Nâng cao</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
