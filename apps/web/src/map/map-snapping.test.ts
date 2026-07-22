import { describe, expect, it } from 'vitest'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { findSnapTarget } from './map-snapping.js'

describe('findSnapTarget', () => {
  const mockMap = {
    project: ([lng, lat]: [number, number]) => ({
      x: lng * 100,
      y: lat * 100,
    }),
  } as unknown as MapLibreMap

  it('returns null if mouse point is far from any vertex', () => {
    const mousePoint = { x: 500, y: 500 }
    const draftPositions: [number, number][] = [[1.0, 1.0]] // screen (100, 100)
    const snap = findSnapTarget(mockMap, mousePoint, draftPositions, [], 15)
    expect(snap).toBeNull()
  })

  it('snaps to closest draft vertex within radius', () => {
    const mousePoint = { x: 102, y: 104 } // dist ~4.47px from (100, 100)
    const draftPositions: [number, number][] = [
      [1.0, 1.0],
      [5.0, 5.0],
    ]
    const snap = findSnapTarget(mockMap, mousePoint, draftPositions, [], 15)
    expect(snap).not.toBeNull()
    expect(snap?.coordinates).toEqual([1.0, 1.0])
    expect(snap?.snapType).toBe('vertex')
  })

  it('snaps to existing geometry vertex within radius', () => {
    const mousePoint = { x: 301, y: 401 } // dist ~1.41px from (3.0, 4.0) -> (300, 400)
    const existingGeoms = [
      {
        type: 'Point' as const,
        coordinates: [3.0, 4.0],
      },
    ]
    const snap = findSnapTarget(mockMap, mousePoint, [], existingGeoms, 15)
    expect(snap).not.toBeNull()
    expect(snap?.coordinates).toEqual([3.0, 4.0])
  })
})
