import type { GeoJsonGeometry } from '@dove/contracts'
import type { GeoJSON } from 'geojson'
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'

import type { Position } from './measurement-map.js'

const asMapGeoJson = (value: unknown) => value as GeoJSON

export function draftCollection(geometry: GeoJsonGeometry | null) {
  return {
    type: 'FeatureCollection' as const,
    features: geometry ? [{ type: 'Feature' as const, properties: {}, geometry }] : [],
  }
}

function draftVertexCollection(points: Position[]) {
  return {
    type: 'FeatureCollection' as const,
    features: points.map((position, index) => ({
      type: 'Feature' as const,
      properties: { latest: index === points.length - 1 },
      geometry: { type: 'Point' as const, coordinates: position },
    })),
  }
}

function createCrosshairImage(): ImageData {
  const size = 44
  const center = Math.floor(size / 2)
  const data = new Uint8ClampedArray(size * size * 4)
  const paintPixel = (x: number, y: number) => {
    const offset = (y * size + x) * 4
    data[offset] = 215
    data[offset + 1] = 25
    data[offset + 2] = 32
    data[offset + 3] = 255
  }
  for (let index = 4; index < size - 4; index += 1) {
    if (Math.abs(index - center) > 5) {
      paintPixel(index, center)
      paintPixel(center, index)
    }
  }
  for (let radius = 6; radius <= 9; radius += 1) {
    for (let angle = 0; angle < 360; angle += 3) {
      const radians = (angle * Math.PI) / 180
      paintPixel(
        Math.round(center + Math.cos(radians) * radius),
        Math.round(center + Math.sin(radians) * radius),
      )
    }
  }
  return new ImageData(data, size, size)
}

export function addDraftSources(
  map: MapLibreMap,
  geometry: GeoJsonGeometry | null,
  points: Position[],
) {
  map.addSource('measurement-draft', {
    type: 'geojson',
    data: asMapGeoJson(draftCollection(geometry)),
  })
  map.addSource('measurement-draft-vertices', {
    type: 'geojson',
    data: asMapGeoJson(draftVertexCollection(points)),
  })
}

export function ensureCrosshairImage(map: MapLibreMap) {
  if (!map.hasImage('crosshair-red')) {
    map.addImage('crosshair-red', createCrosshairImage(), { pixelRatio: 2 })
  }
}

export function addDraftLayers(map: MapLibreMap) {
  map.addLayer({
    id: 'draft-fill',
    source: 'measurement-draft',
    type: 'fill',
    filter: ['==', '$type', 'Polygon'],
    paint: { 'fill-color': '#e5a324', 'fill-opacity': 0.3 },
  })
  map.addLayer({
    id: 'draft-line',
    source: 'measurement-draft',
    type: 'line',
    paint: { 'line-color': '#e07b22', 'line-dasharray': [2, 1], 'line-width': 4 },
  })
  map.addLayer({
    id: 'draft-point',
    source: 'measurement-draft',
    type: 'circle',
    filter: ['==', '$type', 'Point'],
    paint: { 'circle-color': '#e07b22', 'circle-radius': 8 },
  })
  map.addLayer({
    id: 'draft-vertices',
    source: 'measurement-draft-vertices',
    type: 'circle',
    paint: {
      'circle-color': '#ffffff',
      'circle-radius': 9,
      'circle-stroke-color': '#d71920',
      'circle-stroke-width': 3,
    },
  })
  map.addLayer({
    id: 'draft-crosshair',
    source: 'measurement-draft-vertices',
    type: 'symbol',
    filter: ['==', ['get', 'latest'], true],
    layout: {
      'icon-allow-overlap': true,
      'icon-image': 'crosshair-red',
      'icon-ignore-placement': true,
      'icon-size': 1,
    },
  })
}

export function syncDraftData(
  map: MapLibreMap,
  geometry: GeoJsonGeometry | null,
  points: Position[],
) {
  ;(map.getSource('measurement-draft') as GeoJSONSource).setData(
    asMapGeoJson(draftCollection(geometry)),
  )
  ;(map.getSource('measurement-draft-vertices') as GeoJSONSource).setData(
    asMapGeoJson(draftVertexCollection(points)),
  )
}
