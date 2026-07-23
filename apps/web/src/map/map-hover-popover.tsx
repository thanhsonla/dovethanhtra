import type { MapFeature } from '@dove/contracts'
import { formatQuantity } from './measurement-summary.js'

function cleanUnit(unit: string): string {
  if (!unit || unit === 'm.lần') return 'm'
  return unit.replace(/m\.lần/g, 'm')
}

function getQuantityLine(kind: string, rawQty: number, rawUnit: string): string {
  const targetUnit = cleanUnit(rawUnit)
  if (kind === 'point') {
    return `Số điểm: ${formatQuantity(rawQty || 1, targetUnit || 'điểm')}`
  }

  if (kind === 'area' || kind === 'polygon') {
    return `Diện tích: ${formatQuantity(rawQty, targetUnit || 'm²')}`
  }

  // Line String / Route (Length)
  return `Chiều dài: ${formatQuantity(rawQty, targetUnit || 'm')}`
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

  const quantityLine = getQuantityLine(kind, rawQty, rawUnit)

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
  const popoverWidth = 200
  const popoverHeight = 52

  let posX = x + 12
  let posY = y + 12

  if (posX + popoverWidth > viewportWidth - 15) {
    posX = Math.max(10, x - popoverWidth - 12)
  }
  if (posY + popoverHeight > viewportHeight - 15) {
    posY = Math.max(10, y - popoverHeight - 12)
  }

  return (
    <div
      className="map-hover-popover"
      style={{ left: `${posX}px`, top: `${posY}px` }}
      aria-label={`Chi tiết ${displayName}`}
    >
      <div className="map-hover-popover__line1">
        <span className="map-hover-popover__icon" aria-hidden="true">
          {icon}
        </span>
        <span className="map-hover-popover__title" title={displayName}>
          {displayName}
        </span>
      </div>
      <div className="map-hover-popover__line2">
        {quantityLine}
      </div>
    </div>
  )
}
