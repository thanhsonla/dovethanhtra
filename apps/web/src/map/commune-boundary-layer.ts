import type { AdminAreaBoundary } from '@dove/contracts'
import type { GeoJSON } from 'geojson'
import maplibregl, { type GeoJSONSource, type Map as MapLibreMap, type Marker } from 'maplibre-gl'

interface CommuneLabelMarker {
  element: HTMLDivElement
  marker: Marker
}

const asMapGeoJson = (value: unknown) => value as GeoJSON

function boundaryCollection(boundaries: AdminAreaBoundary[]) {
  return {
    type: 'FeatureCollection' as const,
    features: boundaries.map((item) => ({
      type: 'Feature' as const,
      id: item.id,
      properties: { code: item.code, name: item.name, sourceVersion: item.sourceVersion },
      geometry: item.boundary,
    })),
  }
}

export function addCommuneBoundaryLayer(map: MapLibreMap, boundaries: AdminAreaBoundary[]) {
  map.addSource('commune-boundaries', {
    type: 'geojson',
    data: asMapGeoJson(boundaryCollection(boundaries)),
  })
  map.addLayer({
    id: 'commune-boundary-lines',
    source: 'commune-boundaries',
    type: 'line',
    paint: {
      'line-color': '#df1f2d',
      'line-dasharray': [4, 2],
      'line-opacity': 0.95,
      'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.2, 13, 2.2, 17, 3.1],
    },
  })
}

export function syncCommuneBoundaryData(map: MapLibreMap, boundaries: AdminAreaBoundary[]) {
  ;(map.getSource('commune-boundaries') as GeoJSONSource).setData(
    asMapGeoJson(boundaryCollection(boundaries)),
  )
}

function updateLabelScale(map: MapLibreMap, labels: CommuneLabelMarker[]) {
  const zoom = map.getZoom()
  const fontSize = Math.max(9, Math.min(17, 9 + (zoom - 8) * 0.8))
  const maxWidth = Math.max(78, Math.min(150, 78 + (zoom - 8) * 12))
  for (const { element } of labels) {
    element.style.setProperty('--commune-label-font-size', `${fontSize.toFixed(1)}px`)
    element.style.setProperty('--commune-label-max-width', `${maxWidth.toFixed(0)}px`)
  }
}

export function replaceCommuneLabels(
  map: MapLibreMap,
  boundaries: AdminAreaBoundary[],
  current: CommuneLabelMarker[],
) {
  for (const { marker } of current) marker.remove()
  const labels = boundaries.map((item) => {
    const element = document.createElement('div')
    element.className = 'commune-boundary-label'
    element.textContent = item.name.toLocaleUpperCase('vi-VN')
    element.setAttribute('aria-hidden', 'true')
    element.dataset.adminAreaCode = item.code
    const marker = new maplibregl.Marker({
      anchor: 'center',
      element,
      pitchAlignment: 'viewport',
      rotationAlignment: 'viewport',
    })
      .setLngLat(item.labelPoint.coordinates)
      .addTo(map)
    element.removeAttribute('aria-label')
    element.removeAttribute('role')
    return { element, marker }
  })
  updateLabelScale(map, labels)
  return labels
}

export function resizeCommuneLabels(map: MapLibreMap, labels: CommuneLabelMarker[]) {
  updateLabelScale(map, labels)
}

export function removeCommuneLabels(labels: CommuneLabelMarker[]) {
  for (const { marker } of labels) marker.remove()
}

export type { CommuneLabelMarker }
