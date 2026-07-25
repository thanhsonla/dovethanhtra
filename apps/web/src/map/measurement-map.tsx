import type { AdminAreaBoundary, GeoJsonGeometry, MapFeature, Measurement } from '@dove/contracts'
import maplibregl, {
  type AttributionControl,
  type GeoJSONSource,
  type Map as MapLibreMap,
  type Marker,
} from 'maplibre-gl'
import area from '@turf/area'
import length from '@turf/length'
import type { GeoJSON } from 'geojson'
import { useEffect, useRef, useState } from 'react'

import type { BasemapDescriptor, BasemapProvider } from './basemap-provider.js'
import {
  addCommuneBoundaryLayer,
  removeCommuneLabels,
  replaceCommuneLabels,
  resizeCommuneLabels,
  syncCommuneBoundaryData,
  type CommuneLabelMarker,
} from './commune-boundary-layer.js'
import {
  addDraftLayers,
  addDraftSources,
  ensureCrosshairImage,
  syncDraftData,
} from './draft-drawing-layer.js'
import {
  createDraftVertexMarkers,
  createMeasurementEditMarkers,
} from './measurement-edit-markers.js'
import { geometryExtent } from './map-selection.js'
import { MapLocateControl } from './map-locate-control.js'
import { MapHoverPopover } from './map-hover-popover.js'
import { serviceGroupColor, type FieldDisplayMode } from './map-service-colors.js'
import { sanitizeUnit } from './measurement-summary.js'
import {
  calculatePerpendicularSnapping,
  findIntersectionSnapping,
  findSnapTarget,
  type SnapTarget,
} from './map-snapping.js'
import { TouchMagnifierGlass } from './touch-magnifier-glass.js'

export type MapMode = 'view' | 'point' | 'line' | 'area' | 'measure' | 'edit'
export type Position = [number, number]

const asMapGeoJson = (value: unknown) => value as GeoJSON

interface MeasurementMapProps {
  basemapId: string
  basemapProvider: BasemapProvider
  boundary: GeoJsonGeometry
  communeBoundaries: AdminAreaBoundary[]
  draftGeometry: GeoJsonGeometry | null
  draftPositions: Position[]
  draftSelectedIndex: number | null
  editMeasurement: Measurement | null
  fieldMode?: FieldDisplayMode
  focusVersion?: number
  hiddenWorkItemIds: Set<string>
  isMagnifierEnabled?: boolean
  isSnappingEnabled?: boolean
  mapFeatures?: MapFeature[]
  measurements: Measurement[]
  mode: MapMode
  onAddPosition: (position: Position) => void
  onBasemapFallback: () => void
  onEditGeometry: (geometry: GeoJsonGeometry) => void
  onFinishDrawing: () => void
  onSelectDraftVertex: (index: number) => void
  onSelect: (id: string) => void
  onUpdateDraftPosition?: (index: number, position: Position) => void
  onViewportChange: (bbox: string) => void
  selectedId: string | null
  showCommunes: boolean
}

function featureCollection(props: MeasurementMapProps) {
  const mapFeatureMap = new Map((props.mapFeatures ?? []).map((f) => [f.measurement.id, f]))
  const selectedItem = props.measurements.find((m) => m.id === props.selectedId)
  const selectedWorkItemId = selectedItem?.workItemId

  return {
    type: 'FeatureCollection' as const,
    features: props.measurements
      .filter(
        (item) => item.status !== 'superseded' && !props.hiddenWorkItemIds.has(item.workItemId),
      )
      .map((item) => {
        const featureMeta = mapFeatureMap.get(item.id)
        const customColor = item.note?.startsWith('{')
          ? (((JSON.parse(item.note) as Record<string, unknown>).color as string | undefined) ??
            null)
          : null
        const color = customColor ?? serviceGroupColor(featureMeta?.serviceGroupName, props.fieldMode)
        const isSelected = item.id === props.selectedId
        const isGroupMember = Boolean(selectedWorkItemId && item.workItemId === selectedWorkItemId)
        const isDimmed = Boolean(props.selectedId && !isGroupMember)

        const cleanUnitStr = sanitizeUnit(item.unit)
        const qtyStr =
          item.calculatedQuantity != null
            ? `${item.calculatedQuantity.toFixed(1)} ${cleanUnitStr}`.trim()
            : ''
        const label = qtyStr ? `${item.name} (${qtyStr})` : item.name

        return {
          type: 'Feature' as const,
          id: item.id,
          properties: {
            calculatedQuantity: item.calculatedQuantity ?? item.baseValue ?? 0,
            color,
            dimmed: isDimmed,
            geometryKind: item.geometryKind,
            groupMember: isGroupMember,
            id: item.id,
            label,
            name: item.name,
            selected: isSelected,
            status: item.status,
            unit: cleanUnitStr,
            workItemName: featureMeta?.workItemName ?? item.name,
          },
          geometry: item.normalizedGeometry ?? item.rawGeometry,
        }
      }),
  }
}

function boundaryCollection(boundary: GeoJsonGeometry) {
  return {
    type: 'FeatureCollection' as const,
    features: [{ type: 'Feature' as const, properties: {}, geometry: boundary }],
  }
}

function snapIndicatorCollection(snapTarget: SnapTarget | null) {
  return {
    type: 'FeatureCollection' as const,
    features: snapTarget
      ? [
          {
            type: 'Feature' as const,
            properties: { snapType: snapTarget.snapType },
            geometry: { type: 'Point' as const, coordinates: snapTarget.coordinates },
          },
        ]
      : [],
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
  map.addSource('snap-target-source', {
    type: 'geojson',
    data: asMapGeoJson(snapIndicatorCollection(null)),
  })

  addCommuneBoundaryLayer(map, props.communeBoundaries)
  addDraftSources(map, props.draftGeometry, props.draftPositions, props.draftSelectedIndex)

  map.addLayer({
    id: 'measurement-areas',
    source: 'measurements',
    type: 'fill',
    filter: ['==', '$type', 'Polygon'],
    paint: {
      'fill-color': [
        'case',
        ['boolean', ['get', 'selected'], false],
        '#ef7d32',
        ['boolean', ['get', 'groupMember'], false],
        '#f97316',
        ['has', 'color'],
        ['get', 'color'],
        '#25865c',
      ],
      'fill-opacity': ['case', ['boolean', ['get', 'dimmed'], false], 0.12, 0.45],
    },
  })
  map.addLayer({
    id: 'measurement-lines-hit',
    source: 'measurements',
    type: 'line',
    filter: ['==', '$type', 'LineString'],
    paint: {
      'line-color': '#000000',
      'line-opacity': 0,
      'line-width': 24,
    },
  })
  map.addLayer({
    id: 'measurement-lines',
    source: 'measurements',
    type: 'line',
    filter: ['==', '$type', 'LineString'],
    paint: {
      'line-color': [
        'case',
        ['boolean', ['get', 'selected'], false],
        '#ef7d32',
        ['boolean', ['get', 'groupMember'], false],
        '#f97316',
        ['has', 'color'],
        ['get', 'color'],
        '#1675a1',
      ],
      'line-opacity': ['case', ['boolean', ['get', 'dimmed'], false], 0.2, 1.0],
      'line-width': [
        'case',
        ['boolean', ['get', 'selected'], false],
        5,
        ['boolean', ['get', 'groupMember'], false],
        4,
        3,
      ],
    },
  })
  map.addLayer({
    id: 'measurement-points',
    source: 'measurements',
    type: 'circle',
    filter: ['==', '$type', 'Point'],
    paint: {
      'circle-color': [
        'case',
        ['boolean', ['get', 'selected'], false],
        '#ef7d32',
        ['boolean', ['get', 'groupMember'], false],
        '#f97316',
        ['has', 'color'],
        ['get', 'color'],
        '#7c3aed',
      ],
      'circle-opacity': ['case', ['boolean', ['get', 'dimmed'], false], 0.2, 1.0],
      'circle-radius': [
        'case',
        ['boolean', ['get', 'selected'], false],
        10,
        ['boolean', ['get', 'groupMember'], false],
        8,
        7,
      ],
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2,
    },
  })

  // On-Map Feature Labels
  map.addLayer({
    id: 'measurement-line-labels',
    source: 'measurements',
    type: 'symbol',
    filter: ['==', '$type', 'LineString'],
    layout: {
      'symbol-placement': 'line',
      'text-field': ['get', 'label'],
      'text-keep-upright': true,
      'text-size': 11,
    },
    paint: {
      'text-color': '#083c29',
      'text-halo-color': '#ffffff',
      'text-halo-width': 2,
      'text-opacity': ['case', ['boolean', ['get', 'dimmed'], false], 0.2, 1.0],
    },
  })
  map.addLayer({
    id: 'measurement-point-labels',
    source: 'measurements',
    type: 'symbol',
    filter: ['==', '$type', 'Point'],
    layout: {
      'text-anchor': 'top',
      'text-field': ['get', 'label'],
      'text-offset': [0, 1.2],
      'text-size': 11,
    },
    paint: {
      'text-color': '#083c29',
      'text-halo-color': '#ffffff',
      'text-halo-width': 2,
      'text-opacity': ['case', ['boolean', ['get', 'dimmed'], false], 0.2, 1.0],
    },
  })

  // Snap indicator layer
  map.addLayer({
    id: 'snap-indicator-layer',
    source: 'snap-target-source',
    type: 'circle',
    paint: {
      'circle-color': '#06b6d4',
      'circle-radius': 7,
      'circle-stroke-color': '#fbbf24',
      'circle-stroke-width': 3,
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
  syncCommuneBoundaryData(map, props.communeBoundaries)
  syncDraftData(map, props.draftGeometry, props.draftPositions, props.draftSelectedIndex)
  if (map.getLayer('commune-boundary-lines')) {
    map.setLayoutProperty(
      'commune-boundary-lines',
      'visibility',
      props.showCommunes ? 'visible' : 'none',
    )
  }
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

export function MeasurementMap(props: MeasurementMapProps) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markers = useRef<Marker[]>([])
  const communeLabelMarkers = useRef<CommuneLabelMarker[]>([])
  const attributionControl = useRef<AttributionControl | null>(null)
  const attributionRequest = useRef(0)
  const styleRequest = useRef(0)
  const fallbackRequested = useRef(false)
  const lastZoomedSelection = useRef<string | null>(null)
  const activeBasemapId = useRef(props.basemapId)
  const activeSnapTargetRef = useRef<SnapTarget | null>(null)
  const hoveredRefPointsRef = useRef<Position[]>([])

  const [hoveredFeature, setHoveredFeature] = useState<{
    feature: MapFeature
    x: number
    y: number
  } | null>(null)

  const [touchMagnifierState, setTouchMagnifierState] = useState<{
    visible: boolean
    touchX: number
    touchY: number
    snapType?: string | null
  }>({ visible: false, touchX: 0, touchY: 0, snapType: null })

  const [tooltipState, setTooltipState] = useState<{
    text: string
    visible: boolean
    x: number
    y: number
  }>({ text: '', visible: false, x: 0, y: 0 })

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
          preserveDrawingBuffer: true,
          style,
          zoom: 11.5,
        } as maplibregl.MapOptions & { preserveDrawingBuffer?: boolean })
        map.addControl(new maplibregl.NavigationControl(), 'bottom-right')
        applyRotationPolicy(map, descriptor)
        replaceAttribution(map, descriptor.attribution)

        map.on('touchstart', (event) => {
          const current = latest.current
          if (['point', 'line', 'area', 'measure'].includes(current.mode)) {
            const touch = event.originalEvent.touches?.[0]
            if (touch && container.current) {
              const rect = container.current.getBoundingClientRect()
              setTouchMagnifierState({
                visible: true,
                touchX: touch.clientX - rect.left,
                touchY: touch.clientY - rect.top,
                snapType: activeSnapTargetRef.current?.snapType ?? null,
              })
            }
          }
        })

        map.on('touchmove', (event) => {
          const current = latest.current
          if (['point', 'line', 'area', 'measure'].includes(current.mode)) {
            const touch = event.originalEvent.touches?.[0]
            if (touch && container.current) {
              const rect = container.current.getBoundingClientRect()
              setTouchMagnifierState({
                visible: true,
                touchX: touch.clientX - rect.left,
                touchY: touch.clientY - rect.top,
                snapType: activeSnapTargetRef.current?.snapType ?? null,
              })
            }
          }
        })

        const hideTouchLoupe = () => {
          setTouchMagnifierState((prev) => (prev.visible ? { ...prev, visible: false } : prev))
        }

        map.on('touchend', hideTouchLoupe)
        map.on('touchcancel', hideTouchLoupe)
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
        map.on('zoom', () =>
          resizeCommuneLabels(map, communeLabelMarkers.current, latest.current.showCommunes),
        )
        const interactiveLayers = [
          'measurement-areas',
          'measurement-lines',
          'measurement-lines-hit',
          'measurement-points',
        ]
        interactiveLayers.forEach((layerId) => {
          map.on('mouseenter', layerId, () => {
            if (latest.current.mode === 'view') {
              map.getCanvas().style.cursor = 'pointer'
            }
          })
          map.on('mouseleave', layerId, () => {
            if (latest.current.mode === 'view') {
              map.getCanvas().style.cursor = ''
            }
          })
        })

        map.on('mousemove', (event) => {
          const current = latest.current
          if (['point', 'line', 'area', 'measure'].includes(current.mode)) {
            if (current.isMagnifierEnabled && container.current) {
              setTouchMagnifierState({
                visible: true,
                touchX: event.point.x,
                touchY: event.point.y,
                snapType: activeSnapTargetRef.current?.snapType ?? null,
              })
            }

            const existingGeometries = current.measurements.map(
              (m) => m.normalizedGeometry ?? m.rawGeometry,
            )
            const snapTarget =
              current.isSnappingEnabled !== false
                ? findSnapTarget(
                    map,
                    event.point,
                    current.draftPositions,
                    existingGeometries,
                  )
                : null
            activeSnapTargetRef.current = snapTarget

            if (snapTarget?.snapType === 'vertex') {
              const pos = snapTarget.coordinates
              const existing = hoveredRefPointsRef.current
              if (!existing.some((p) => p[0] === pos[0] && p[1] === pos[1])) {
                hoveredRefPointsRef.current = [...existing, pos].slice(-2)
              }
            }

            const snapSource = map.getSource<GeoJSONSource>('snap-target-source')
            if (snapSource) {
              snapSource.setData(asMapGeoJson(snapIndicatorCollection(snapTarget)))
            }

            let activePos = snapTarget
              ? snapTarget.coordinates
              : ([event.lngLat.lng, event.lngLat.lat] as Position)

            let isIntersection = false
            let isPerpendicular = false
            let isParallel = false
            let cornerLines: [Position, Position, Position] | null = null
            let interGuideLines: Array<[Position, Position]> = []

            const effectiveRefPoints: Position[] = []
            if (current.draftPositions.length >= 1) {
              effectiveRefPoints.push(current.draftPositions[current.draftPositions.length - 1]!)
            }
            for (const refP of hoveredRefPointsRef.current) {
              if (!effectiveRefPoints.some((ep) => ep[0] === refP[0] && ep[1] === refP[1])) {
                effectiveRefPoints.push(refP)
              }
            }

            if (!snapTarget && effectiveRefPoints.length >= 2) {
              const interSnap = findIntersectionSnapping(map, event.point, effectiveRefPoints)
              if (interSnap) {
                activePos = interSnap.activePos
                isIntersection = true
                cornerLines = interSnap.cornerSymbolLines
                interGuideLines = interSnap.guideLines
              }
            }

            if (!snapTarget && !isIntersection && current.draftPositions.length >= 2) {
              const alignSnap = calculatePerpendicularSnapping(
                map,
                event.point,
                current.draftPositions,
              )
              if (alignSnap) {
                activePos = alignSnap.activePos
                isPerpendicular = alignSnap.isPerpendicular
                isParallel = alignSnap.isParallel
                cornerLines = alignSnap.cornerSymbolLines
              }
            }

            const refPointsSource = map.getSource<GeoJSONSource>('measurement-ref-points-source')
            if (refPointsSource) {
              const refFeatures = hoveredRefPointsRef.current.map((pos) => ({
                type: 'Feature' as const,
                properties: {},
                geometry: { type: 'Point' as const, coordinates: pos },
              }))
              refPointsSource.setData(
                asMapGeoJson({ type: 'FeatureCollection', features: refFeatures }),
              )
            }

            const guideSource = map.getSource<GeoJSONSource>('measurement-guide-source')
            if (guideSource) {
              const guideFeatures: GeoJSON.Feature[] = []
              if (isIntersection && interGuideLines.length > 0) {
                for (const gLine of interGuideLines) {
                  guideFeatures.push({
                    type: 'Feature',
                    properties: { isPerpendicular: true },
                    geometry: { type: 'LineString', coordinates: gLine },
                  })
                }
                if (cornerLines) {
                  guideFeatures.push({
                    type: 'Feature',
                    properties: { isPerpendicularSymbol: true },
                    geometry: { type: 'LineString', coordinates: cornerLines },
                  })
                }
              } else if (current.draftPositions.length >= 1) {
                const lastPos = current.draftPositions[current.draftPositions.length - 1]!
                guideFeatures.push({
                  type: 'Feature',
                  properties: { isParallel, isPerpendicular },
                  geometry: { type: 'LineString', coordinates: [lastPos, activePos] },
                })
                if (current.mode === 'area' && current.draftPositions.length >= 2) {
                  guideFeatures.push({
                    type: 'Feature',
                    properties: { isClosing: true },
                    geometry: {
                      type: 'LineString',
                      coordinates: [activePos, current.draftPositions[0]!],
                    },
                  })
                }
                if (cornerLines) {
                  guideFeatures.push({
                    type: 'Feature',
                    properties: { isPerpendicularSymbol: true },
                    geometry: { type: 'LineString', coordinates: cornerLines },
                  })
                }
              }
              guideSource.setData(
                asMapGeoJson({ type: 'FeatureCollection', features: guideFeatures }),
              )
            }

            const perpTag = isIntersection
              ? ' 🎯 Giao điểm vuông góc (90°)'
              : isPerpendicular
                ? ' ∟ Vuông góc (90°)'
                : isParallel
                  ? ' ═ Song song'
                  : ''
            let text = ''

            if (current.mode === 'point') {
              text = 'Nhấp để chọn điểm'
            } else if (
              (current.mode === 'line' || current.mode === 'measure') &&
              current.draftPositions.length > 0
            ) {
              const linePositions = [...current.draftPositions, activePos]
              const feature = {
                type: 'Feature' as const,
                properties: {},
                geometry: { type: 'LineString' as const, coordinates: linePositions },
              }
              const distM = length(feature) * 1000
              text =
                current.mode === 'measure'
                  ? `Đo nháp: ${distM.toFixed(1)} m${perpTag}`
                  : `Chiều dài: ${distM.toFixed(1)} m${perpTag}`
            } else if (current.mode === 'area' && current.draftPositions.length >= 2) {
              const polyPositions = [
                ...current.draftPositions,
                activePos,
                current.draftPositions[0]!,
              ]
              const feature = {
                type: 'Feature' as const,
                properties: {},
                geometry: { type: 'Polygon' as const, coordinates: [polyPositions] },
              }
              const areaM2 = area(feature)
              text = `Diện tích: ${areaM2.toFixed(1)} m²${perpTag}`
            } else if (current.mode === 'measure') {
              text = 'Nhấp để bắt đầu đo nháp'
            }

            if (text) {
              setTooltipState({ text, visible: true, x: event.point.x, y: event.point.y })
            } else {
              setTooltipState((prev) => (prev.visible ? { ...prev, visible: false } : prev))
            }
            setHoveredFeature(null)
          } else {
            activeSnapTargetRef.current = null
            hoveredRefPointsRef.current = []
            const refPointsSource = map.getSource<GeoJSONSource>('measurement-ref-points-source')
            if (refPointsSource) {
              refPointsSource.setData(
                asMapGeoJson({ type: 'FeatureCollection', features: [] }),
              )
            }
            const guideSource = map.getSource<GeoJSONSource>('measurement-guide-source')
            if (guideSource) {
              guideSource.setData(
                asMapGeoJson({ type: 'FeatureCollection', features: [] }),
              )
            }
            setTooltipState((prev) => (prev.visible ? { ...prev, visible: false } : prev))

            if (current.mode === 'view') {
              const hit = map.queryRenderedFeatures(event.point, { layers: interactiveLayers })[0]
              const hitId: unknown = hit?.properties?.id
              if (typeof hitId === 'string') {
                const foundFeature = current.mapFeatures?.find((f) => f.measurement.id === hitId)
                const measurementObj = current.measurements.find((m) => m.id === hitId)

                const hitProps = hit?.properties ?? {}
                const propQty =
                  typeof hitProps.calculatedQuantity === 'number'
                    ? hitProps.calculatedQuantity
                    : Number(hitProps.calculatedQuantity || 0)
                const propUnit = (hitProps.unit as string | undefined) || ''
                const propWorkName = (hitProps.workItemName as string | undefined) || ''

                if (foundFeature) {
                  const updatedQty =
                    foundFeature.measurement.calculatedQuantity ||
                    propQty ||
                    foundFeature.measurement.baseValue ||
                    0
                  setHoveredFeature({
                    feature: {
                      ...foundFeature,
                      measurement: {
                        ...foundFeature.measurement,
                        calculatedQuantity: updatedQty,
                        unit: foundFeature.measurement.unit || propUnit,
                      },
                    },
                    x: event.point.x,
                    y: event.point.y,
                  })
                } else if (measurementObj) {
                  const updatedQty =
                    measurementObj.calculatedQuantity ||
                    propQty ||
                    measurementObj.baseValue ||
                    0
                  const fallbackFeature: MapFeature = {
                    measurement: {
                      ...measurementObj,
                      calculatedQuantity: updatedQty,
                      unit: measurementObj.unit || propUnit,
                    },
                    managementZoneId: null,
                    managementZoneName: null,
                    serviceGroupId: '',
                    serviceGroupName: '',
                    workItemName: propWorkName || measurementObj.name,
                    workComponentName: null,
                  }
                  setHoveredFeature({ feature: fallbackFeature, x: event.point.x, y: event.point.y })
                } else {
                  setHoveredFeature(null)
                }
              } else {
                setHoveredFeature(null)
              }
            } else {
              setHoveredFeature(null)
            }
          }
        })

        map.on('click', (event) => {
          const current = latest.current
          if (['point', 'line', 'area', 'measure'].includes(current.mode)) {
            const vertex = map.queryRenderedFeatures(event.point, {
              layers: ['draft-vertex-hit', 'draft-vertices'],
            })[0]
            const index: unknown = vertex?.properties?.index
            if (typeof index === 'number') {
              current.onSelectDraftVertex(index)
              return
            }
            const clickPos = activeSnapTargetRef.current?.coordinates ?? [
              event.lngLat.lng,
              event.lngLat.lat,
            ]
            current.onAddPosition(clickPos)
            return
          }
          const hit = map.queryRenderedFeatures(event.point, {
            layers: interactiveLayers,
          })[0]
          const id: unknown = hit?.properties?.id
          if (typeof id === 'string') {
            current.onSelect(id)
          } else {
            current.onSelect('')
          }
        })
        map.on('dblclick', (event) => {
          if (['line', 'area', 'measure'].includes(latest.current.mode)) {
            event.preventDefault()
            latest.current.onFinishDrawing()
          }
        })
        mapRef.current = map
        communeLabelMarkers.current = replaceCommuneLabels(
          map,
          latest.current.communeBoundaries,
          communeLabelMarkers.current,
          latest.current.showCommunes,
        )
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
      removeCommuneLabels(communeLabelMarkers.current)
      communeLabelMarkers.current = []
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
    props.communeBoundaries,
    props.draftGeometry,
    props.draftPositions,
    props.draftSelectedIndex,
    props.hiddenWorkItemIds,
    props.mapFeatures,
    props.measurements,
    props.selectedId,
    props.showCommunes,
  ])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    communeLabelMarkers.current = replaceCommuneLabels(
      map,
      props.communeBoundaries,
      communeLabelMarkers.current,
      props.showCommunes,
    )
  }, [props.communeBoundaries, props.showCommunes])

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
    if (!map || !props.selectedId) return
    const selectionKey = `${props.selectedId}:${props.focusVersion ?? 0}`
    if (lastZoomedSelection.current === selectionKey) return
    const measurement = props.measurements.find((item) => item.id === props.selectedId)
    if (!measurement) return
    const extent = geometryExtent(measurement.normalizedGeometry ?? measurement.rawGeometry)
    if (!extent) return
    lastZoomedSelection.current = selectionKey
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
  }, [props.focusVersion, props.measurements, props.selectedId])

  useEffect(() => {
    markers.current.forEach((marker) => marker.remove())
    markers.current = []
    const map = mapRef.current
    if (!map) return

    if (props.mode === 'edit') {
      const geometry =
        props.editMeasurement?.normalizedGeometry ?? props.editMeasurement?.rawGeometry
      if (!geometry) return
      markers.current = createMeasurementEditMarkers(map, geometry, (updatedGeometry) =>
        props.onEditGeometry(updatedGeometry),
      )
      return
    }

    if (
      ['point', 'line', 'area', 'measure'].includes(props.mode) &&
      props.draftPositions.length > 0 &&
      props.onUpdateDraftPosition
    ) {
      markers.current = createDraftVertexMarkers(
        map,
        props.draftPositions,
        props.onUpdateDraftPosition,
      )
    }
  }, [
    props.draftPositions,
    props.editMeasurement,
    props.mode,
    props.onEditGeometry,
    props.onUpdateDraftPosition,
  ])

  return (
    <div
      className="measurement-map"
      data-field-mode={props.fieldMode ?? 'normal'}
      ref={container}
      aria-label="Bản đồ phép đo"
    >
      <MapLocateControl map={mapRef.current} />
      {tooltipState.visible && (
        <div
          className="map-cursor-tooltip"
          style={{ left: `${tooltipState.x}px`, top: `${tooltipState.y}px` }}
        >
          {tooltipState.text}
        </div>
      )}
      {hoveredFeature && props.mode === 'view' && (
        <MapHoverPopover
          feature={hoveredFeature.feature}
          x={hoveredFeature.x}
          y={hoveredFeature.y}
        />
      )}
      <TouchMagnifierGlass
        mapCanvas={mapRef.current ? mapRef.current.getCanvas() : null}
        touchX={touchMagnifierState.touchX}
        touchY={touchMagnifierState.touchY}
        visible={
          touchMagnifierState.visible &&
          ['point', 'line', 'area', 'measure'].includes(props.mode)
        }
        snapType={touchMagnifierState.snapType}
        triggerRepaint={() => mapRef.current?.triggerRepaint()}
      />
    </div>
  )
}
