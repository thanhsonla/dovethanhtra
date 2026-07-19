import { describe, expect, it } from 'vitest'

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
    expect(provider.defaultId).toBe('technical-light')
    expect(provider.descriptors()).toHaveLength(2)
  })

  it('adds an attributed Mapbox satellite raster layer for a public token', () => {
    const provider = new ConfiguredBasemapProvider({
      VITE_MAPBOX_PUBLIC_TOKEN: 'pk.public-test-token',
    })
    const satellite = provider.get('mapbox-satellite')
    expect(provider.defaultId).toBe('mapbox-satellite')
    expect(provider.supportsOffline('mapbox-satellite')).toBe(false)
    expect(satellite).toMatchObject({
      id: 'mapbox-satellite',
      label: 'Vệ tinh Mapbox',
    })
    expect(satellite.attribution).toContain('© Mapbox')
    expect(JSON.stringify(satellite.style)).toContain('satellite-streets-v12')
  })

  it.each(['sk.secret-token', 'pk.invalid&token', ''])('rejects unsafe Mapbox tokens', (token) => {
    const provider = new ConfiguredBasemapProvider({ VITE_MAPBOX_PUBLIC_TOKEN: token })
    expect(provider.descriptors().map((item) => item.id)).not.toContain('mapbox-satellite')
  })
})
