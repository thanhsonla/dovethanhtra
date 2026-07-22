import type { GeoJsonGeometry } from '@dove/contracts'
import type { Map as MapLibreMap } from 'maplibre-gl'

import type { Position } from './measurement-map.js'

export interface SnapTarget {
  coordinates: Position
  snapType: 'vertex' | 'edge'
}

function distancePx(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
  const dx = p1.x - p2.x
  const dy = p1.y - p2.y
  return Math.sqrt(dx * dx + dy * dy)
}

export function findSnapTarget(
  map: MapLibreMap,
  mousePoint: { x: number; y: number },
  draftPositions: Position[],
  existingGeometries: GeoJsonGeometry[],
  snapRadiusPx: number = 15,
): SnapTarget | null {
  let closestTarget: SnapTarget | null = null
  let minDistance = snapRadiusPx

  const candidatePositions: Position[] = [...draftPositions]

  for (const geom of existingGeometries) {
    if (geom.type === 'Point') {
      candidatePositions.push(geom.coordinates as Position)
    } else if (geom.type === 'LineString') {
      for (const pos of geom.coordinates as Position[]) {
        candidatePositions.push(pos)
      }
    } else if (geom.type === 'Polygon') {
      const ring = (geom.coordinates as Position[][])[0] ?? []
      for (const pos of ring) {
        candidatePositions.push(pos)
      }
    }
  }

  for (const pos of candidatePositions) {
    const screenPx = map.project(pos)
    const dist = distancePx(mousePoint, screenPx)
    if (dist < minDistance) {
      minDistance = dist
      closestTarget = { coordinates: pos, snapType: 'vertex' }
    }
  }

  return closestTarget
}
