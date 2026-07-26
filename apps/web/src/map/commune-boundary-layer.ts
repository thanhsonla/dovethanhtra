import type { AdminAreaBoundary } from '@dove/contracts'
import type { GeoJSON } from 'geojson'
import maplibregl, { type GeoJSONSource, type Map as MapLibreMap, type Marker } from 'maplibre-gl'

import { COMMUNE_BOUNDARY_COLORS } from './map-service-colors.js'

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
      'line-color': COMMUNE_BOUNDARY_COLORS.line,
      'line-dasharray': [3, 2],
      'line-opacity': 0.78,
      'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1, 13, 1.7, 17, 2.4],
    },
  })
}

export function syncCommuneBoundaryData(map: MapLibreMap, boundaries: AdminAreaBoundary[]) {
  ;(map.getSource('commune-boundaries') as GeoJSONSource).setData(
    asMapGeoJson(boundaryCollection(boundaries)),
  )
}

function updateLabelScale(
  map: MapLibreMap,
  labels: CommuneLabelMarker[],
  showCommunes: boolean = true,
) {
  if (!showCommunes) {
    for (const { element } of labels) {
      element.style.display = 'none'
    }
    return
  }

  const zoom = map.getZoom()
  const fontSize = Math.max(8, Math.min(15, 8 + (zoom - 8) * 0.6))
  const maxWidth = Math.max(78, Math.min(150, 78 + (zoom - 8) * 12))

  const allowed = [
    'tô hiệu',
    'mai sơn',
    'thuận châu',
    'yên châu',
    'phù yên',
    'bắc yên',
    'vân hồ',
    'mộc châu',
    'sốp cộp',
    'mường la',
    'quỳnh nhai',
  ]

  for (const { element } of labels) {
    element.style.setProperty('--commune-label-font-size', `${fontSize.toFixed(1)}px`)
    element.style.setProperty('--commune-label-max-width', `${maxWidth.toFixed(0)}px`)

    if (zoom < 10.5) {
      const text = (element.textContent || '').toLowerCase()
      const matches = allowed.some((name) => text.includes(name))
      if (matches) {
        element.style.display = 'block'
      } else {
        element.style.display = 'none'
      }
    } else {
      element.style.display = 'block'
    }
  }
}

export function replaceCommuneLabels(
  map: MapLibreMap,
  boundaries: AdminAreaBoundary[],
  current: CommuneLabelMarker[],
  showCommunes: boolean = true,
) {
  for (const { marker } of current) marker.remove()
  const labels = boundaries.map((item) => {
    const element = document.createElement('div')
    element.className = 'commune-boundary-label'
    element.textContent = item.name.toLocaleUpperCase('vi-VN')
    element.style.color = COMMUNE_BOUNDARY_COLORS.label
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
  updateLabelScale(map, labels, showCommunes)
  return labels
}

export function resizeCommuneLabels(
  map: MapLibreMap,
  labels: CommuneLabelMarker[],
  showCommunes: boolean = true,
) {
  updateLabelScale(map, labels, showCommunes)
}

export function removeCommuneLabels(labels: CommuneLabelMarker[]) {
  for (const { marker } of labels) marker.remove()
}

export type { CommuneLabelMarker }
