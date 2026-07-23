import type { MapFeature } from '@dove/contracts'

export function MapHoverPopover(props: {
  feature: MapFeature
  x: number
  y: number
}) {
  const { feature, x, y } = props
  const { measurement, workItemName } = feature

  // Formatting actual measurement volume
  const qtyFormatted =
    measurement.calculatedQuantity != null
      ? measurement.calculatedQuantity < 10
        ? measurement.calculatedQuantity.toFixed(2)
        : measurement.calculatedQuantity.toFixed(1)
      : '0'
  const unitStr = measurement.unit || ''
  const volumeDisplay = `${qtyFormatted} ${unitStr}`.trim()

  // Full name of route/street/work
  const displayName =
    measurement.name && measurement.name !== workItemName
      ? `${workItemName} (${measurement.name})`
      : workItemName

  // Representative photo image URL (if attached in note or default sample field thumbnail)
  let photoUrl: string | null = null
  if (measurement.note?.includes('http')) {
    const match = measurement.note.match(/(https?:\/\/[^\s"]+)/)
    if (match) photoUrl = match[1] ?? null
  }

  // Positioning popover cleanly so it stays within viewport
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1200
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800
  const popoverWidth = 240
  const popoverHeight = photoUrl ? 170 : 110

  let posX = x + 15
  let posY = y + 15

  if (posX + popoverWidth > viewportWidth - 20) {
    posX = Math.max(10, x - popoverWidth - 15)
  }
  if (posY + popoverHeight > viewportHeight - 20) {
    posY = Math.max(10, y - popoverHeight - 15)
  }

  return (
    <div
      className="map-hover-popover"
      style={{ left: `${posX}px`, top: `${posY}px` }}
      aria-label={`Chi tiết ${displayName}`}
    >
      <div className="map-hover-popover__content">
        <div className="map-hover-popover__header">
          <span className="map-hover-popover__icon" aria-hidden="true">
            🛣️
          </span>
          <span className="map-hover-popover__title" title={displayName}>
            {displayName}
          </span>
        </div>

        <div className="map-hover-popover__body">
          <div className="map-hover-popover__volume-container">
            <span className="map-hover-popover__volume-label">Khối lượng thực tế</span>
            <div className="map-hover-popover__volume-value">
              {volumeDisplay}
            </div>
          </div>

          {photoUrl ? (
            <div className="map-hover-popover__photo-preview">
              <img src={photoUrl} alt="Ảnh chụp thực địa" />
            </div>
          ) : (
            <div className="map-hover-popover__photo-badge" title="Ảnh chụp thực địa">
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <span>Thực địa</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
