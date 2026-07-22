import { describe, expect, it, vi } from 'vitest'
import type { StyleSpecification } from 'maplibre-gl'

import { ConfiguredBasemapProvider, prepareUprightGoogleHybridStyle } from './basemap-provider.js'

describe('configured basemap provider', () => {
  it('uses only attributed HTTPS styles and retains the local fallback', () => {
    const provider = new ConfiguredBasemapProvider({
      VITE_BASEMAP_ATTRIBUTION: '© Nhà cung cấp kiểm thử',
      VITE_BASEMAP_LABEL: 'Nền kiểm thử',
      VITE_BASEMAP_STYLE_URL: 'https://maps.example.test/style.json',
    })
    expect(provider.defaultId).toBe('google-hybrid-stores')
    expect(provider.get('configured-remote')).toMatchObject({
      attribution: '© Nhà cung cấp kiểm thử',
      label: 'Nền kiểm thử',
    })
    expect(provider.supportsOffline('configured-remote')).toBe(false)
    expect(provider.descriptors().some((item) => provider.supportsOffline(item.id))).toBe(true)
  })

  it.each([
    { VITE_BASEMAP_STYLE_URL: 'https://maps.example.test/style.json' },
    {
      VITE_BASEMAP_ATTRIBUTION: 'Không hợp lệ',
      VITE_BASEMAP_STYLE_URL: 'http://maps.example.test/style.json',
    },
    {
      VITE_BASEMAP_ATTRIBUTION: 'Không hợp lệ',
      VITE_BASEMAP_STYLE_URL: 'https://user:password@maps.example.test/style.json',
    },
  ])('rejects incomplete or unsafe remote configuration', (environment) => {
    const provider = new ConfiguredBasemapProvider(environment)
    expect(provider.defaultId).toBe('google-hybrid-stores')
    expect(provider.descriptors()).toHaveLength(5)
  })

  it('adds an attributed Mapbox satellite raster layer for a public token', () => {
    const provider = new ConfiguredBasemapProvider({
      VITE_MAPBOX_PUBLIC_TOKEN: 'pk.public-test-token',
    })
    const satellite = provider.get('mapbox-satellite')
    const upright = provider.get('google-hybrid-upright')
    expect(provider.defaultId).toBe('google-hybrid-stores')
    expect(upright.label).toBe('Google vệ tinh · nhãn dễ đọc')
    expect(upright.loadStyle).toBeTypeOf('function')
    expect(provider.supportsOffline('mapbox-satellite')).toBe(false)
    expect(satellite).toMatchObject({
      id: 'mapbox-satellite',
      label: 'Vệ tinh Mapbox + địa danh',
      lockRotation: true,
    })
    expect(satellite.attribution).toContain('© Mapbox')
    expect(JSON.stringify(satellite.style)).toContain('satellite-streets-v12')
  })

  it('places Google imagery below screen-aligned Mapbox vector labels', () => {
    const sourceStyle = {
      version: 8 as const,
      name: 'Thuộc tính riêng của Mapbox',
      sprite: 'mapbox://sprites/mapbox/satellite-streets-v12',
      glyphs: 'mapbox://fonts/mapbox/{fontstack}/{range}.pbf',
      sources: {
        'mapbox-satellite': { type: 'raster' as const, url: 'mapbox://mapbox.satellite' },
        composite: { type: 'vector' as const, url: 'mapbox://mapbox.mapbox-streets-v8' },
      },
      layers: [
        { id: 'satellite', type: 'raster' as const, source: 'mapbox-satellite' },
        {
          id: 'place-label',
          type: 'symbol' as const,
          source: 'composite',
          'source-layer': 'place_label',
          layout: { 'text-field': ['get', 'name'] },
        },
        {
          id: 'road-label',
          type: 'symbol' as const,
          source: 'composite',
          'source-layer': 'road',
          layout: { 'symbol-placement': 'line', 'text-field': ['get', 'name'] },
        },
        {
          id: 'road-label-center',
          type: 'symbol' as const,
          source: 'composite',
          'source-layer': 'road',
          layout: { 'symbol-placement': 'line-center', 'text-field': ['get', 'name'] },
        },
      ],
    } as StyleSpecification

    const style = prepareUprightGoogleHybridStyle(sourceStyle, 'pk.public-test-token')
    const label = style.layers.find((layer) => layer.id === 'place-label')
    const roadLabel = style.layers.find((layer) => layer.id === 'road-label')
    const centeredRoadLabel = style.layers.find((layer) => layer.id === 'road-label-center')

    expect(JSON.stringify(sourceStyle.layers[0])).toContain('mapbox-satellite')
    expect(JSON.stringify(style.layers[0])).toContain('google-satellite-upright')
    expect(JSON.stringify(style.sources)).toContain('mt1.google.com/vt/lyrs=s')
    expect(JSON.stringify(style.sources)).toContain('api.mapbox.com/v4/mapbox.mapbox-streets-v8')
    expect(style).not.toHaveProperty('name')
    expect(label?.layout).toMatchObject({
      'text-keep-upright': true,
      'text-pitch-alignment': 'viewport',
      'text-rotation-alignment': 'viewport',
    })
    expect(roadLabel?.layout).toMatchObject({
      'symbol-placement': 'line',
      'text-keep-upright': true,
      'text-pitch-alignment': 'map',
      'text-rotation-alignment': 'map',
    })
    expect(centeredRoadLabel?.layout).toMatchObject({
      'text-pitch-alignment': 'map',
      'text-rotation-alignment': 'map',
    })
  })

  it('provides an Esri imagery plus reference-layer fallback without a token', () => {
    const provider = new ConfiguredBasemapProvider({})
    const esri = provider.get('esri-imagery-labels')
    const style = JSON.stringify(esri.style)

    expect(provider.defaultId).toBe('google-hybrid-stores')
    expect(esri.label).toBe('Vệ tinh + địa danh')
    expect(style).toContain('World_Imagery/MapServer/tile/{z}/{y}/{x}')
    expect(style).toContain('World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}')
    expect(style).toContain('World_Transportation/MapServer/tile/{z}/{y}/{x}')
    expect(provider.supportsOffline(esri.id)).toBe(false)
  })

  it('uses the owner-approved direct Google hybrid endpoint through the adapter', () => {
    const provider = new ConfiguredBasemapProvider({})
    const google = provider.get('google-hybrid-direct')

    expect(google.label).toBe('Google vệ tinh · khóa hướng Bắc')
    expect(google.lockRotation).toBe(true)
    expect(JSON.stringify(google.style)).toContain(
      'https://mt1.google.com/vt/lyrs=s&hl=vi&x={x}&y={y}&z={z}',
    )
    expect(google.attribution).toContain('Google Maps')
    expect(provider.supportsOffline(google.id)).toBe(false)
  })

  it.each(['sk.secret-token', 'pk.invalid&token', ''])('rejects unsafe Mapbox tokens', (token) => {
    const provider = new ConfiguredBasemapProvider({ VITE_MAPBOX_PUBLIC_TOKEN: token })
    expect(provider.descriptors().map((item) => item.id)).not.toContain('mapbox-satellite')
  })

  it('adds a server-proxied Google hybrid layer and escapes dynamic attribution', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof URL ? input.href : typeof input === 'string' ? input : input.url
      expect(url).toContain('/api/v1/basemaps/google/viewport?')
      return new Response(JSON.stringify({ attribution: '<b>Map data</b> © Google' }))
    })
    const provider = new ConfiguredBasemapProvider({}, { googleMapTiles: true }, fetcher)
    const google = provider.get('google-satellite-labels')

    expect(provider.defaultId).toBe('google-hybrid-stores')
    expect(provider.supportsOffline(google.id)).toBe(false)
    expect(JSON.stringify(google.style)).toContain('/api/v1/basemaps/google/tiles/{z}/{x}/{y}')
    await expect(
      google.viewportAttribution?.({ east: 105, north: 21, south: 20, west: 104, zoom: 11 }),
    ).resolves.toContain('&lt;b&gt;Map data&lt;/b&gt;')
  })
})
