import { useEffect, type ReactNode } from 'react'

export function MapDrawer(props: {
  children: ReactNode
  id: string
  label: string
  onClose: () => void
  side?: 'left' | 'right'
  variant?: 'compact'
}) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') props.onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [props.onClose])

  return (
    <aside
      aria-label={props.label}
      aria-modal="false"
      className={`map-drawer map-drawer--${props.side ?? 'left'}${props.variant ? ` map-drawer--${props.variant}` : ''}`}
      id={props.id}
      role="dialog"
    >
      <header className="map-drawer__header">
        <strong>{props.label}</strong>
        <button
          aria-label={`Đóng ${props.label.toLocaleLowerCase('vi')}`}
          onClick={props.onClose}
          type="button"
        >
          ×
        </button>
      </header>
      <div className="map-drawer__body">{props.children}</div>
    </aside>
  )
}
