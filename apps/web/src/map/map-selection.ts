import type { GeoJsonGeometry } from '@dove/contracts'

export interface GeometryExtent {
  east: number
  north: number
  south: number
  west: number
}

function visit(value: unknown, extent: GeometryExtent) {
  if (!Array.isArray(value)) return
  if (typeof value[0] === 'number' && typeof value[1] === 'number') {
    extent.west = Math.min(extent.west, value[0])
    extent.east = Math.max(extent.east, value[0])
    extent.south = Math.min(extent.south, value[1])
    extent.north = Math.max(extent.north, value[1])
    return
  }
  value.forEach((child) => visit(child, extent))
}

export function geometryExtent(geometry: GeoJsonGeometry): GeometryExtent | null {
  const extent = { east: -Infinity, north: -Infinity, south: Infinity, west: Infinity }
  visit(geometry.coordinates, extent)
  return Number.isFinite(extent.west) ? extent : null
}
