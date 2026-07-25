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

function draftVertexCollection(points: Position[], selectedIndex: number | null) {
  return {
    type: 'FeatureCollection' as const,
    features: points.map((position, index) => ({
      type: 'Feature' as const,
      properties: { index, latest: index === points.length - 1, selected: index === selectedIndex },
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
  selectedIndex: number | null,
) {
  map.addSource('measurement-draft', {
    type: 'geojson',
    data: asMapGeoJson(draftCollection(geometry)),
  })
  map.addSource('measurement-draft-vertices', {
    type: 'geojson',
    data: asMapGeoJson(draftVertexCollection(points, selectedIndex)),
  })
  map.addSource('measurement-guide-source', {
    type: 'geojson',
    data: asMapGeoJson({ type: 'FeatureCollection', features: [] }),
  })
}

export function ensureCrosshairImage(map: MapLibreMap) {
  if (!map.hasImage('crosshair-red')) {
    map.addImage('crosshair-red', createCrosshairImage(), { pixelRatio: 2 })
  }
}

export function addDraftLayers(map: MapLibreMap) {
  map.addLayer({
    id: 'draft-guide-line',
    source: 'measurement-guide-source',
    type: 'line',
    paint: {
      'line-color': [
        'case',
        ['boolean', ['get', 'isPerpendicularSymbol'], false],
        '#00ff66',
        ['boolean', ['get', 'isPerpendicular'], false],
        '#00ff66',
        ['boolean', ['get', 'isParallel'], false],
        '#ffff00',
        '#0284c7',
      ],
      'line-dasharray': [
        'case',
        ['boolean', ['get', 'isPerpendicularSymbol'], false],
        ['literal', [1, 0]],
        ['literal', [3, 3]],
      ],
      'line-width': ['case', ['boolean', ['get', 'isPerpendicularSymbol'], false], 2.5, 2],
      'line-opacity': 0.9,
    },
  })
  map.addLayer({
    id: 'draft-fill',
    source: 'measurement-draft',
    type: 'fill',
    filter: ['==', '$type', 'Polygon'],
    paint: { 'fill-color': '#e5a324', 'fill-opacity': 0.3 },
  })
  map.addLayer({
    id: 'draft-line-casing',
    source: 'measurement-draft',
    type: 'line',
    paint: {
      'line-color': '#ffffff',
      'line-opacity': 0.94,
      'line-width': 7,
    },
  })
  map.addLayer({
    id: 'draft-line',
    source: 'measurement-draft',
    type: 'line',
    paint: { 'line-color': '#ff5a1f', 'line-opacity': 1, 'line-width': 4 },
  })
  map.addLayer({
    id: 'draft-point',
    source: 'measurement-draft',
    type: 'circle',
    filter: ['==', '$type', 'Point'],
    paint: { 'circle-color': '#e07b22', 'circle-radius': 8 },
  })
  map.addLayer({
    id: 'draft-vertex-hit',
    source: 'measurement-draft-vertices',
    type: 'circle',
    layout: {
      visibility: 'none',
    },
    paint: {
      'circle-color': '#ffffff',
      'circle-opacity': 0.01,
      'circle-radius': 22,
    },
  })
  map.addLayer({
    id: 'draft-vertices',
    source: 'measurement-draft-vertices',
    type: 'circle',
    layout: {
      visibility: 'none',
    },
    paint: {
      'circle-color': ['case', ['boolean', ['get', 'selected'], false], '#ef7d32', '#ffffff'],
      'circle-radius': ['case', ['boolean', ['get', 'selected'], false], 8, 6],
      'circle-stroke-color': '#e07b22',
      'circle-stroke-width': 2,
    },
  })
}

export function syncDraftData(
  map: MapLibreMap,
  geometry: GeoJsonGeometry | null,
  points: Position[],
  selectedIndex: number | null,
) {
  ;(map.getSource('measurement-draft') as GeoJSONSource).setData(
    asMapGeoJson(draftCollection(geometry)),
  )
  ;(map.getSource('measurement-draft-vertices') as GeoJSONSource).setData(
    asMapGeoJson(draftVertexCollection(points, selectedIndex)),
  )
}
