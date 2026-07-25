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

export interface AlignmentSnapResult {
  activePos: Position
  cornerSymbolLines: [Position, Position, Position] | null
  isParallel: boolean
  isPerpendicular: boolean
}

export function calculatePerpendicularSnapping(
  map: MapLibreMap,
  mousePoint: { x: number; y: number },
  draftPositions: Position[],
  tolerancePx: number = 14,
): AlignmentSnapResult | null {
  if (draftPositions.length < 2) return null

  const p1 = map.project(draftPositions[draftPositions.length - 2]!)
  const p2 = map.project(draftPositions[draftPositions.length - 1]!)
  const c = mousePoint

  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len < 2) return null

  const tx = dx / len
  const ty = dy / len
  const nx = -ty
  const ny = tx

  const wx = c.x - p2.x
  const wy = c.y - p2.y

  const wt = wx * tx + wy * ty
  const wn = wx * nx + wy * ny

  const distToPerp = Math.abs(wt)
  const distToParallel = Math.abs(wn)

  if (distToPerp <= tolerancePx) {
    const snapPx: [number, number] = [p2.x + wn * nx, p2.y + wn * ny]
    const unprojected = map.unproject(snapPx)
    const activePos: Position = [unprojected.lng, unprojected.lat]

    const size = 12
    const signN = wn >= 0 ? 1 : -1
    const signT = wt >= 0 ? 1 : -1

    const cornerA: [number, number] = [p2.x + signN * size * nx, p2.y + signN * size * ny]
    const cornerB: [number, number] = [
      p2.x + signN * size * nx + signT * size * tx,
      p2.y + signN * size * ny + signT * size * ty,
    ]
    const cornerC: [number, number] = [p2.x + signT * size * tx, p2.y + signT * size * ty]

    const llA = map.unproject(cornerA)
    const llB = map.unproject(cornerB)
    const llC = map.unproject(cornerC)

    return {
      activePos,
      cornerSymbolLines: [
        [llA.lng, llA.lat],
        [llB.lng, llB.lat],
        [llC.lng, llC.lat],
      ],
      isParallel: false,
      isPerpendicular: true,
    }
  }

  if (distToParallel <= tolerancePx) {
    const snapPx: [number, number] = [p2.x + wt * tx, p2.y + wt * ty]
    const unprojected = map.unproject(snapPx)
    const activePos: Position = [unprojected.lng, unprojected.lat]
    return {
      activePos,
      cornerSymbolLines: null,
      isParallel: true,
      isPerpendicular: false,
    }
  }

  return null
}

export interface IntersectionSnapResult {
  activePos: Position
  cornerSymbolLines: [Position, Position, Position]
  guideLines: Array<[Position, Position]>
  refPointA: Position
  refPointB: Position
}

export function findIntersectionSnapping(
  map: MapLibreMap,
  mousePoint: { x: number; y: number },
  refPoints: Position[],
  tolerancePx: number = 20,
): IntersectionSnapResult | null {
  if (refPoints.length < 2) return null

  const pA = refPoints[refPoints.length - 2]!
  const pB = refPoints[refPoints.length - 1]!

  const screenA = map.project(pA)
  const screenB = map.project(pB)

  const c1Px = { x: screenA.x, y: screenB.y }
  const c2Px = { x: screenB.x, y: screenA.y }

  const dist1 = Math.hypot(mousePoint.x - c1Px.x, mousePoint.y - c1Px.y)
  const dist2 = Math.hypot(mousePoint.x - c2Px.x, mousePoint.y - c2Px.y)

  let chosenPx: { x: number; y: number } | null = null
  let refStemA = screenA
  let refStemB = screenB

  if (dist1 <= tolerancePx && dist1 <= dist2) {
    chosenPx = c1Px
  } else if (dist2 <= tolerancePx) {
    chosenPx = c2Px
    refStemA = screenB
    refStemB = screenA
  }

  if (!chosenPx) return null

  const unprojected = map.unproject([chosenPx.x, chosenPx.y])
  const activePos: Position = [unprojected.lng, unprojected.lat]

  const size = 12
  const dirAx = Math.sign(refStemA.x - chosenPx.x) || 1
  const dirBy = Math.sign(refStemB.y - chosenPx.y) || 1

  const cornerA: [number, number] = [chosenPx.x + dirAx * size, chosenPx.y]
  const cornerB: [number, number] = [chosenPx.x + dirAx * size, chosenPx.y + dirBy * size]
  const cornerC: [number, number] = [chosenPx.x, chosenPx.y + dirBy * size]

  const llA = map.unproject(cornerA)
  const llB = map.unproject(cornerB)
  const llC = map.unproject(cornerC)

  return {
    activePos,
    cornerSymbolLines: [
      [llA.lng, llA.lat],
      [llB.lng, llB.lat],
      [llC.lng, llC.lat],
    ],
    guideLines: [
      [pA, activePos],
      [pB, activePos],
    ],
    refPointA: pA,
    refPointB: pB,
  }
}
