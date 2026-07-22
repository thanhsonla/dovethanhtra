import type { GeoJsonGeometry } from '@dove/contracts'
import maplibregl, { type Map as MapLibreMap, type Marker } from 'maplibre-gl'

type Position = [number, number]

interface MidpointHandle {
  position: Position
  segmentIndex: number
}

function createNodeHandleElement(isDraft = false): HTMLDivElement {
  const el = document.createElement('div')
  el.className = isDraft ? 'map-node-handle map-node-handle--draft' : 'map-node-handle'
  el.title = 'Kéo để di chuyển đỉnh'
  return el
}

function createMidpointHandleElement(): HTMLDivElement {
  const el = document.createElement('div')
  el.className = 'map-midpoint-handle'
  el.title = 'Kích hoặc kéo để tách đôi đoạn thẳng'
  el.innerHTML = '<span aria-hidden="true">+</span>'
  return el
}

function positions(geometry: GeoJsonGeometry): Position[] | null {
  if (geometry.type === 'Point') return [geometry.coordinates as Position]
  if (geometry.type === 'LineString') return geometry.coordinates as Position[]
  if (geometry.type === 'Polygon')
    return (geometry.coordinates as Position[][])[0]?.slice(0, -1) ?? []
  return null
}

function midpoints(geometry: GeoJsonGeometry): MidpointHandle[] | null {
  if (geometry.type === 'LineString') {
    const coords = geometry.coordinates as Position[]
    if (coords.length < 2) return []
    const list: MidpointHandle[] = []
    for (let i = 0; i < coords.length - 1; i += 1) {
      const p1 = coords[i]
      const p2 = coords[i + 1]
      if (p1 && p2) {
        list.push({ position: [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2], segmentIndex: i })
      }
    }
    return list
  }
  if (geometry.type === 'Polygon') {
    const ring = (geometry.coordinates as Position[][])[0] ?? []
    if (ring.length < 3) return []
    const list: MidpointHandle[] = []
    for (let i = 0; i < ring.length - 1; i += 1) {
      const p1 = ring[i]
      const p2 = ring[i + 1]
      if (p1 && p2) {
        list.push({ position: [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2], segmentIndex: i })
      }
    }
    return list
  }
  return null
}

function replacePosition(
  geometry: GeoJsonGeometry,
  index: number,
  position: Position,
): GeoJsonGeometry {
  if (geometry.type === 'Point') return { type: 'Point', coordinates: position }
  if (geometry.type === 'LineString') {
    const coordinates = [...(geometry.coordinates as Position[])]
    coordinates[index] = position
    return { type: 'LineString', coordinates }
  }
  const ring = [...((geometry.coordinates as Position[][])[0] ?? [])]
  ring[index] = position
  if (index === 0) ring[ring.length - 1] = position
  return { type: 'Polygon', coordinates: [ring] }
}

function insertMidpoint(
  geometry: GeoJsonGeometry,
  segmentIndex: number,
  position: Position,
): GeoJsonGeometry {
  if (geometry.type === 'LineString') {
    const coords = [...(geometry.coordinates as Position[])]
    coords.splice(segmentIndex + 1, 0, position)
    return { type: 'LineString', coordinates: coords }
  }
  if (geometry.type === 'Polygon') {
    const ring = [...((geometry.coordinates as Position[][])[0] ?? [])]
    ring.splice(segmentIndex + 1, 0, position)
    return { type: 'Polygon', coordinates: [ring] }
  }
  return geometry
}

export function createMeasurementEditMarkers(
  map: MapLibreMap,
  geometry: GeoJsonGeometry,
  onEditGeometry: (geometry: GeoJsonGeometry) => void,
): Marker[] {
  let currentGeometry = geometry
  const editable = positions(geometry)
  if (!editable) return []

  const vertexMarkers = editable.map((position, index) => {
    const el = createNodeHandleElement(false)
    const marker = new maplibregl.Marker({ anchor: 'center', element: el, draggable: true })
      .setLngLat(position)
      .addTo(map)

    marker.on('drag', () => {
      const lngLat = marker.getLngLat()
      currentGeometry = replacePosition(currentGeometry, index, [lngLat.lng, lngLat.lat])
    })

    marker.on('dragend', () => {
      const lngLat = marker.getLngLat()
      currentGeometry = replacePosition(currentGeometry, index, [lngLat.lng, lngLat.lat])
      onEditGeometry(currentGeometry)
    })

    return marker
  })

  const midpointList = midpoints(geometry) ?? []
  const midpointMarkers = midpointList.map((mid) => {
    const el = createMidpointHandleElement()
    const marker = new maplibregl.Marker({ anchor: 'center', element: el, draggable: true })
      .setLngLat(mid.position)
      .addTo(map)

    let splitDone = false
    const triggerSplit = () => {
      if (splitDone) return
      splitDone = true
      const lngLat = marker.getLngLat()
      currentGeometry = insertMidpoint(currentGeometry, mid.segmentIndex, [lngLat.lng, lngLat.lat])
      onEditGeometry(currentGeometry)
    }

    el.addEventListener('click', (e) => {
      e.stopPropagation()
      triggerSplit()
    })

    marker.on('dragstart', triggerSplit)
    marker.on('dragend', () => {
      const lngLat = marker.getLngLat()
      currentGeometry = replacePosition(currentGeometry, mid.segmentIndex + 1, [
        lngLat.lng,
        lngLat.lat,
      ])
      onEditGeometry(currentGeometry)
    })

    return marker
  })

  return [...vertexMarkers, ...midpointMarkers]
}

export function createDraftVertexMarkers(
  map: MapLibreMap,
  positionsList: Position[],
  onUpdateDraftPosition: (index: number, position: Position) => void,
): Marker[] {
  if (!positionsList || positionsList.length === 0) return []
  return positionsList.map((position, index) => {
    const el = createNodeHandleElement(true)
    const marker = new maplibregl.Marker({ anchor: 'center', element: el, draggable: true })
      .setLngLat(position)
      .addTo(map)
    const handleDrag = () => {
      const lngLat = marker.getLngLat()
      onUpdateDraftPosition(index, [lngLat.lng, lngLat.lat])
    }
    marker.on('drag', handleDrag)
    marker.on('dragend', handleDrag)
    return marker
  })
}
