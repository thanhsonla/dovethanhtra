import { describe, expect, it, vi } from 'vitest'

import { ConfiguredBasemapProvider } from './basemap-provider.js'

describe('configured basemap provider', () => {
  it('uses only attributed HTTPS styles and retains the local fallback', () => {
    const provider = new ConfiguredBasemapProvider({
      VITE_BASEMAP_ATTRIBUTION: '© Nhà cung cấp kiểm thử',
      VITE_BASEMAP_LABEL: 'Nền kiểm thử',
      VITE_BASEMAP_STYLE_URL: 'https://maps.example.test/style.json',
    })
    expect(provider.defaultId).toBe('configured-remote')
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
    expect(provider.defaultId).toBe('esri-imagery-labels')
    expect(provider.descriptors()).toHaveLength(3)
  })

  it('adds an attributed Mapbox satellite raster layer for a public token', () => {
    const provider = new ConfiguredBasemapProvider({
      VITE_MAPBOX_PUBLIC_TOKEN: 'pk.public-test-token',
    })
    const satellite = provider.get('mapbox-satellite')
    expect(provider.defaultId).toBe('esri-imagery-labels')
    expect(provider.supportsOffline('mapbox-satellite')).toBe(false)
    expect(satellite).toMatchObject({
      id: 'mapbox-satellite',
      label: 'Vệ tinh Mapbox',
    })
    expect(satellite.attribution).toContain('© Mapbox')
    expect(JSON.stringify(satellite.style)).toContain('satellite-streets-v12')
  })

  it('uses the same Esri imagery plus reference-layer pattern as sonla-map-project', () => {
    const provider = new ConfiguredBasemapProvider({})
    const esri = provider.get('esri-imagery-labels')
    const style = JSON.stringify(esri.style)

    expect(provider.defaultId).toBe('esri-imagery-labels')
    expect(esri.label).toBe('Vệ tinh + địa danh')
    expect(style).toContain('World_Imagery/MapServer/tile/{z}/{y}/{x}')
    expect(style).toContain('World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}')
    expect(style).toContain('World_Transportation/MapServer/tile/{z}/{y}/{x}')
    expect(provider.supportsOffline(esri.id)).toBe(false)
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

    expect(provider.defaultId).toBe('google-satellite-labels')
    expect(provider.supportsOffline(google.id)).toBe(false)
    expect(JSON.stringify(google.style)).toContain('/api/v1/basemaps/google/tiles/{z}/{x}/{y}')
    await expect(
      google.viewportAttribution?.({ east: 105, north: 21, south: 20, west: 104, zoom: 11 }),
    ).resolves.toContain('&lt;b&gt;Map data&lt;/b&gt;')
  })
})
