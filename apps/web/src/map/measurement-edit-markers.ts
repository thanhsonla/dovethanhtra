import type { GeoJsonGeometry } from '@dove/contracts'
import maplibregl, { type Map as MapLibreMap, type Marker } from 'maplibre-gl'

type Position = [number, number]

function positions(geometry: GeoJsonGeometry): Position[] | null {
  if (geometry.type === 'Point') return [geometry.coordinates as Position]
  if (geometry.type === 'LineString') return geometry.coordinates as Position[]
  if (geometry.type === 'Polygon')
    return (geometry.coordinates as Position[][])[0]?.slice(0, -1) ?? []
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

export function createMeasurementEditMarkers(
  map: MapLibreMap,
  geometry: GeoJsonGeometry,
  onEditGeometry: (geometry: GeoJsonGeometry) => void,
): Marker[] {
  const editable = positions(geometry)
  if (!editable) return []
  return editable.map((position, index) => {
    const marker = new maplibregl.Marker({ color: '#ef7d32', draggable: true })
      .setLngLat(position)
      .addTo(map)
    marker.on('dragend', () => {
      const lngLat = marker.getLngLat()
      onEditGeometry(replacePosition(geometry, index, [lngLat.lng, lngLat.lat]))
    })
    return marker
  })
}
