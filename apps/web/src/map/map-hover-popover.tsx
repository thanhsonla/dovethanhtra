import type { MapFeature } from '@dove/contracts'

function getQuantityDetails(kind: string, rawQty: number, rawUnit: string) {
  if (kind === 'point') {
    return {
      label: 'SỐ ĐIỂM',
      value: `${rawQty || 1} điểm`,
    }
  }

  if (kind === 'area' || kind === 'polygon') {
    if (rawQty >= 10000) {
      const haValue = rawQty / 10000
      return {
        label: 'DIỆN TÍCH',
        value: `${haValue < 10 ? haValue.toFixed(2) : haValue.toFixed(1)} ha`,
      }
    }
    return {
      label: 'DIỆN TÍCH',
      value: `${rawQty < 10 ? rawQty.toFixed(2) : rawQty.toFixed(1)} ${rawUnit || 'm²'}`.trim(),
    }
  }

  // Line String / Route (Length)
  return {
    label: 'CHIỀU DÀI',
    value: `${rawQty < 10 ? rawQty.toFixed(2) : rawQty.toFixed(1)} ${rawUnit || 'm.lần'}`.trim(),
  }
}

export function MapHoverPopover(props: {
  feature: MapFeature
  x: number
  y: number
}) {
  const { feature, x, y } = props
  const { measurement, workItemName } = feature

  // Raw quantity calculation
  const rawQty = measurement.calculatedQuantity ?? measurement.baseValue ?? 0
  const kind = (measurement.geometryKind as string) || 'line'
  const rawUnit = measurement.unit || ''

  const { label: quantityLabel, value: quantityValue } = getQuantityDetails(kind, rawQty, rawUnit)

  // Route / Street / Work Name
  const displayName =
    measurement.name && measurement.name !== workItemName
      ? `${workItemName} (${measurement.name})`
      : workItemName || measurement.name || 'Phép đo'

  // Icon corresponding to geometry kind
  const icon = kind === 'area' || kind === 'polygon' ? '📐' : kind === 'point' ? '📍' : '🛣️'

  // Positioning popover cleanly so it stays within viewport
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1200
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800
  const popoverWidth = 220
  const popoverHeight = 85

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
            {icon}
          </span>
          <span className="map-hover-popover__title" title={displayName}>
            {displayName}
          </span>
        </div>

        <div className="map-hover-popover__body">
          <div className="map-hover-popover__volume-container">
            <span className="map-hover-popover__volume-label">{quantityLabel}</span>
            <div className="map-hover-popover__volume-value">{quantityValue}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
