import type { MapMode } from './measurement-map.js'

export function DrawingToolbar(props: {
  canRedo: boolean
  canUndo: boolean
  mode: MapMode
  onCancel(): void
  onFinish(): void
  onHistory(direction: 'undo' | 'redo'): void
}) {
  const drawing = props.mode === 'point' || props.mode === 'line' || props.mode === 'area'
  const editing = props.mode === 'edit'
  if (!drawing && !editing) return null

  return (
    <div className="map-toolbar" aria-label="Điều khiển thao tác bản đồ">
      {(props.mode === 'line' || props.mode === 'area') && (
        <button className="map-tool--active" onClick={() => props.onFinish()} type="button">
          Kết thúc
        </button>
      )}
      <button disabled={!props.canUndo} onClick={() => props.onHistory('undo')} type="button">
        {drawing ? 'Lùi điểm' : 'Hoàn tác'}
      </button>
      <button disabled={!props.canRedo} onClick={() => props.onHistory('redo')} type="button">
        {drawing ? 'Khôi phục điểm' : 'Làm lại'}
      </button>
      <button onClick={() => props.onCancel()} type="button">
        Hủy
      </button>
    </div>
  )
}
