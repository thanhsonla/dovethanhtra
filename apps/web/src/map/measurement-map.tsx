import type { GeoJsonGeometry, Measurement } from '@dove/contracts'
import maplibregl, { type GeoJSONSource, type Map as MapLibreMap, type Marker } from 'maplibre-gl'
import type { GeoJSON } from 'geojson'
import { useEffect, useRef } from 'react'

import type { BasemapProvider } from './basemap-provider.js'

export type MapMode = 'view' | 'point' | 'line' | 'area' | 'edit'
export type Position = [number, number]

const asMapGeoJson = (value: unknown) => value as GeoJSON

interface MeasurementMapProps {
  basemapId: string
  basemapProvider: BasemapProvider
  boundary: GeoJsonGeometry
  draftGeometry: GeoJsonGeometry | null
  editMeasurement: Measurement | null
  hiddenWorkItemIds: Set<string>
  measurements: Measurement[]
  mode: MapMode
  onAddPosition(position: Position): void
  onEditGeometry(geometry: GeoJsonGeometry): void
  onFinishDrawing(): void
  onSelect(id: string): void
  selectedId: string | null
}

function featureCollection(props: MeasurementMapProps) {
  return {
    type: 'FeatureCollection' as const,
    features: props.measurements
      .filter(
        (item) => item.status !== 'superseded' && !props.hiddenWorkItemIds.has(item.workItemId),
      )
      .map((item) => ({
        type: 'Feature' as const,
        id: item.id,
        properties: {
          id: item.id,
          selected: item.id === props.selectedId,
          status: item.status,
        },
        geometry: item.normalizedGeometry ?? item.rawGeometry,
      })),
  }
}

function boundaryCollection(boundary: GeoJsonGeometry) {
  return {
    type: 'FeatureCollection' as const,
    features: [{ type: 'Feature' as const, properties: {}, geometry: boundary }],
  }
}

function draftCollection(geometry: GeoJsonGeometry | null) {
  return {
    type: 'FeatureCollection' as const,
    features: geometry ? [{ type: 'Feature' as const, properties: {}, geometry }] : [],
  }
}

function ensureLayers(map: MapLibreMap, props: MeasurementMapProps) {
  if (map.getSource('case-boundary')) return
  map.addSource('case-boundary', {
    type: 'geojson',
    data: asMapGeoJson(boundaryCollection(props.boundary)),
  })
  map.addSource('measurements', {
    type: 'geojson',
    data: asMapGeoJson(featureCollection(props)),
  })
  map.addSource('measurement-draft', {
    type: 'geojson',
    data: asMapGeoJson(draftCollection(props.draftGeometry)),
  })
  map.addLayer({
    id: 'case-boundary-fill',
    source: 'case-boundary',
    type: 'fill',
    paint: { 'fill-color': '#4f8f72', 'fill-opacity': 0.08 },
  })
  map.addLayer({
    id: 'case-boundary-line',
    source: 'case-boundary',
    type: 'line',
    paint: { 'line-color': '#287052', 'line-dasharray': [3, 2], 'line-width': 2 },
  })
  map.addLayer({
    id: 'measurement-areas',
    source: 'measurements',
    type: 'fill',
    filter: ['==', '$type', 'Polygon'],
    paint: {
      'fill-color': ['case', ['boolean', ['get', 'selected'], false], '#ef7d32', '#25865c'],
      'fill-opacity': 0.35,
    },
  })
  map.addLayer({
    id: 'measurement-lines',
    source: 'measurements',
    type: 'line',
    filter: ['==', '$type', 'LineString'],
    paint: {
      'line-color': ['case', ['boolean', ['get', 'selected'], false], '#ef7d32', '#1675a1'],
      'line-width': ['case', ['boolean', ['get', 'selected'], false], 6, 4],
    },
  })
  map.addLayer({
    id: 'measurement-points',
    source: 'measurements',
    type: 'circle',
    filter: ['==', '$type', 'Point'],
    paint: {
      'circle-color': ['case', ['boolean', ['get', 'selected'], false], '#ef7d32', '#7c3aed'],
      'circle-radius': ['case', ['boolean', ['get', 'selected'], false], 9, 7],
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2,
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
}

function syncData(map: MapLibreMap, props: MeasurementMapProps) {
  if (!map.isStyleLoaded()) return
  ensureLayers(map, props)
  ;(map.getSource('case-boundary') as GeoJSONSource).setData(
    asMapGeoJson(boundaryCollection(props.boundary)),
  )
  ;(map.getSource('measurements') as GeoJSONSource).setData(asMapGeoJson(featureCollection(props)))
  ;(map.getSource('measurement-draft') as GeoJSONSource).setData(
    asMapGeoJson(draftCollection(props.draftGeometry)),
  )
}

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

export function MeasurementMap(props: MeasurementMapProps) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markers = useRef<Marker[]>([])
  const activeBasemapId = useRef(props.basemapId)
  const latest = useRef(props)
  latest.current = props

  useEffect(() => {
    if (!container.current) return
    const descriptor = props.basemapProvider.get(props.basemapId)
    const map = new maplibregl.Map({
      attributionControl: false,
      center: [104.685, 20.805],
      container: container.current,
      doubleClickZoom: false,
      style: descriptor.style,
      zoom: 11.5,
    })
    map.addControl(new maplibregl.NavigationControl(), 'bottom-right')
    map.addControl(
      new maplibregl.AttributionControl({
        compact: true,
        customAttribution: descriptor.attribution,
      }),
    )
    map.on('style.load', () => syncData(map, latest.current))
    map.on('click', (event) => {
      const current = latest.current
      if (['point', 'line', 'area'].includes(current.mode)) {
        current.onAddPosition([event.lngLat.lng, event.lngLat.lat])
        return
      }
      const hit = map.queryRenderedFeatures(event.point, {
        layers: ['measurement-areas', 'measurement-lines', 'measurement-points'],
      })[0]
      const id: unknown = hit?.properties?.id
      if (typeof id === 'string') current.onSelect(id)
    })
    map.on('dblclick', (event) => {
      if (['line', 'area'].includes(latest.current.mode)) {
        event.preventDefault()
        latest.current.onFinishDrawing()
      }
    })
    mapRef.current = map
    return () => {
      markers.current.forEach((marker) => marker.remove())
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (map) syncData(map, props)
  }, [
    props.boundary,
    props.draftGeometry,
    props.hiddenWorkItemIds,
    props.measurements,
    props.selectedId,
  ])

  useEffect(() => {
    const map = mapRef.current
    if (!map || activeBasemapId.current === props.basemapId) return
    activeBasemapId.current = props.basemapId
    const descriptor = props.basemapProvider.get(props.basemapId)
    map.setStyle(descriptor.style)
  }, [props.basemapId, props.basemapProvider])

  useEffect(() => {
    markers.current.forEach((marker) => marker.remove())
    markers.current = []
    const map = mapRef.current
    const geometry = props.editMeasurement?.rawGeometry
    if (!map || props.mode !== 'edit' || !geometry) return
    const editable = positions(geometry)
    if (!editable) return
    markers.current = editable.map((position, index) => {
      const marker = new maplibregl.Marker({ color: '#ef7d32', draggable: true })
        .setLngLat(position)
        .addTo(map)
      marker.on('dragend', () => {
        const lngLat = marker.getLngLat()
        props.onEditGeometry(replacePosition(geometry, index, [lngLat.lng, lngLat.lat]))
      })
      return marker
    })
  }, [props.editMeasurement, props.mode])

  return <div className="measurement-map" ref={container} aria-label="Bản đồ phép đo" />
}
