import type { GeoJsonGeometry, Measurement } from '@dove/contracts'
import maplibregl, {
  type AttributionControl,
  type GeoJSONSource,
  type Map as MapLibreMap,
  type Marker,
} from 'maplibre-gl'
import type { GeoJSON } from 'geojson'
import { useEffect, useRef } from 'react'

import type { BasemapDescriptor, BasemapProvider } from './basemap-provider.js'
import {
  addDraftLayers,
  addDraftSources,
  ensureCrosshairImage,
  syncDraftData,
} from './draft-drawing-layer.js'
import { geometryExtent } from './map-selection.js'

export type MapMode = 'view' | 'point' | 'line' | 'area' | 'edit'
export type Position = [number, number]

const asMapGeoJson = (value: unknown) => value as GeoJSON

interface MeasurementMapProps {
  basemapId: string
  basemapProvider: BasemapProvider
  boundary: GeoJsonGeometry
  draftGeometry: GeoJsonGeometry | null
  draftPositions: Position[]
  draftSelectedIndex: number | null
  editMeasurement: Measurement | null
  hiddenWorkItemIds: Set<string>
  measurements: Measurement[]
  mode: MapMode
  onAddPosition(position: Position): void
  onBasemapFallback(): void
  onEditGeometry(geometry: GeoJsonGeometry): void
  onFinishDrawing(): void
  onSelectDraftVertex(index: number): void
  onSelect(id: string): void
  onViewportChange(bbox: string): void
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

function ensureLayers(map: MapLibreMap, props: MeasurementMapProps) {
  if (map.getSource('case-boundary')) return
  ensureCrosshairImage(map)
  map.addSource('case-boundary', {
    type: 'geojson',
    data: asMapGeoJson(boundaryCollection(props.boundary)),
  })
  map.addSource('measurements', {
    type: 'geojson',
    data: asMapGeoJson(featureCollection(props)),
  })
  addDraftSources(map, props.draftGeometry, props.draftPositions, props.draftSelectedIndex)
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
  addDraftLayers(map)
}

function syncData(map: MapLibreMap, props: MeasurementMapProps) {
  if (!map.isStyleLoaded()) return
  ensureLayers(map, props)
  ;(map.getSource('case-boundary') as GeoJSONSource).setData(
    asMapGeoJson(boundaryCollection(props.boundary)),
  )
  ;(map.getSource('measurements') as GeoJSONSource).setData(asMapGeoJson(featureCollection(props)))
  syncDraftData(map, props.draftGeometry, props.draftPositions, props.draftSelectedIndex)
}

function applyRotationPolicy(map: MapLibreMap, descriptor: BasemapDescriptor) {
  if (descriptor.lockRotation) {
    map.dragRotate.disable()
    map.touchZoomRotate.disableRotation()
    if (Math.abs(map.getBearing()) > 0.01) map.setBearing(0)
    return
  }
  map.dragRotate.enable()
  map.touchZoomRotate.enableRotation()
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
  const attributionControl = useRef<AttributionControl | null>(null)
  const attributionRequest = useRef(0)
  const styleRequest = useRef(0)
  const fallbackRequested = useRef(false)
  const lastZoomedId = useRef<string | null>(null)
  const activeBasemapId = useRef(props.basemapId)
  const latest = useRef(props)
  latest.current = props

  const replaceAttribution = (map: MapLibreMap, attribution: string) => {
    if (attributionControl.current && map.hasControl(attributionControl.current)) {
      map.removeControl(attributionControl.current)
    }
    attributionControl.current = new maplibregl.AttributionControl({
      compact: true,
      customAttribution: attribution,
    })
    map.addControl(attributionControl.current)
    map
      .getContainer()
      .querySelector('.maplibregl-ctrl-attrib')
      ?.classList.remove('maplibregl-compact-show')
  }

  const refreshAttribution = (map: MapLibreMap, descriptor: BasemapDescriptor) => {
    const requestId = ++attributionRequest.current
    replaceAttribution(map, descriptor.attribution)
    if (!descriptor.viewportAttribution) return
    const bounds = map.getBounds()
    void descriptor
      .viewportAttribution({
        east: bounds.getEast(),
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        west: bounds.getWest(),
        zoom: Math.max(0, Math.min(22, Math.round(map.getZoom()))),
      })
      .then((attribution) => {
        if (requestId === attributionRequest.current && mapRef.current === map) {
          replaceAttribution(map, attribution)
        }
      })
      .catch(() => undefined)
  }

  const reportViewport = (map: MapLibreMap) => {
    const bounds = map.getBounds()
    latest.current.onViewportChange(
      [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()]
        .map((value) => value.toFixed(6))
        .join(','),
    )
  }

  useEffect(() => {
    if (!container.current) return
    const descriptor = props.basemapProvider.get(props.basemapId)
    let disposed = false
    const requestId = ++styleRequest.current
    void (descriptor.loadStyle?.() ?? Promise.resolve(descriptor.style))
      .then((style) => {
        if (disposed || requestId !== styleRequest.current || !container.current) return
        const map = new maplibregl.Map({
          attributionControl: false,
          center: [104.685, 20.805],
          container: container.current,
          doubleClickZoom: false,
          style,
          zoom: 11.5,
        })
        map.addControl(new maplibregl.NavigationControl(), 'bottom-right')
        applyRotationPolicy(map, descriptor)
        replaceAttribution(map, descriptor.attribution)
        map.on('style.load', () => {
          syncData(map, latest.current)
          refreshAttribution(map, latest.current.basemapProvider.get(latest.current.basemapId))
          reportViewport(map)
        })
        map.on('moveend', () => {
          refreshAttribution(map, latest.current.basemapProvider.get(latest.current.basemapId))
          reportViewport(map)
        })
        map.on('rotate', () => {
          const active = latest.current.basemapProvider.get(latest.current.basemapId)
          if (active.lockRotation && Math.abs(map.getBearing()) > 0.01) map.setBearing(0)
        })
        map.on('click', (event) => {
          const current = latest.current
          if (['point', 'line', 'area'].includes(current.mode)) {
            const vertex = map.queryRenderedFeatures(event.point, {
              layers: ['draft-vertex-hit', 'draft-vertices'],
            })[0]
            const index: unknown = vertex?.properties?.index
            if (typeof index === 'number') {
              current.onSelectDraftVertex(index)
              return
            }
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
        map.on('error', () => {
          const current = latest.current
          const active = current.basemapProvider.get(current.basemapId)
          if (!current.basemapProvider.supportsOffline(active.id) && !fallbackRequested.current) {
            fallbackRequested.current = true
            current.onBasemapFallback()
          }
        })
        mapRef.current = map
      })
      .catch(() => {
        if (!disposed && !fallbackRequested.current) {
          fallbackRequested.current = true
          latest.current.onBasemapFallback()
        }
      })
    return () => {
      disposed = true
      styleRequest.current += 1
      attributionRequest.current += 1
      markers.current.forEach((marker) => marker.remove())
      mapRef.current?.remove()
      attributionControl.current = null
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (map) syncData(map, props)
  }, [
    props.boundary,
    props.draftGeometry,
    props.draftPositions,
    props.draftSelectedIndex,
    props.hiddenWorkItemIds,
    props.measurements,
    props.selectedId,
  ])

  useEffect(() => {
    const map = mapRef.current
    if (!map || activeBasemapId.current === props.basemapId) return
    activeBasemapId.current = props.basemapId
    fallbackRequested.current = false
    const descriptor = props.basemapProvider.get(props.basemapId)
    applyRotationPolicy(map, descriptor)
    const requestId = ++styleRequest.current
    void (descriptor.loadStyle?.() ?? Promise.resolve(descriptor.style))
      .then((style) => {
        if (requestId !== styleRequest.current || mapRef.current !== map) return
        map.setStyle(style)
        refreshAttribution(map, descriptor)
      })
      .catch(() => {
        if (!fallbackRequested.current) {
          fallbackRequested.current = true
          latest.current.onBasemapFallback()
        }
      })
  }, [props.basemapId, props.basemapProvider])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !props.selectedId || lastZoomedId.current === props.selectedId) return
    const measurement = props.measurements.find((item) => item.id === props.selectedId)
    if (!measurement) return
    const extent = geometryExtent(measurement.normalizedGeometry ?? measurement.rawGeometry)
    if (!extent) return
    lastZoomedId.current = props.selectedId
    if (extent.west === extent.east && extent.south === extent.north) {
      map.easeTo({
        center: [extent.west, extent.south],
        duration: 450,
        zoom: Math.max(map.getZoom(), 16),
      })
    } else {
      map.fitBounds(
        [
          [extent.west, extent.south],
          [extent.east, extent.north],
        ],
        {
          duration: 450,
          maxZoom: 17,
          padding: 90,
        },
      )
    }
  }, [props.measurements, props.selectedId])

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
