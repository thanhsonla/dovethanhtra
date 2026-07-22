import { describe, expect, it, vi } from 'vitest'

import { GoogleMapTilesProvider } from './google-map-tiles-provider.js'

describe('Google Map Tiles adapter', () => {
  it('creates one Vietnamese satellite session and proxies tiles without exposing the key', async () => {
    const fetcher = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      const url =
        input instanceof URL ? input : new URL(typeof input === 'string' ? input : input.url)
      if (url.pathname === '/v1/createSession') {
        expect(typeof init?.body).toBe('string')
        expect(JSON.parse(init?.body as string)).toEqual({
          language: 'vi-VN',
          layerTypes: [],
          mapType: 'satellite',
          overlay: false,
          region: 'VN',
          scale: 'scaleFactor1x',
        })
        return new Response(
          JSON.stringify({ expiry: String(Math.floor(Date.now() / 1000) + 3600), session: 's1' }),
        )
      }
      expect(url.pathname).toBe('/v1/2dtiles/11/1619/906')
      expect(url.searchParams.get('key')).toBe('server-only-key')
      expect(url.searchParams.get('session')).toBe('s1')
      return new Response(new Uint8Array([1, 2, 3]), {
        headers: { 'content-type': 'image/png' },
      })
    })
    const provider = new GoogleMapTilesProvider('server-only-key', 1000, fetcher)
    const first = await provider.getTile(11, 1619, 906)
    const second = await provider.getTile(11, 1619, 906)

    expect(first).toMatchObject({ contentType: 'image/png' })
    expect(first.bytes).toEqual(Buffer.from([1, 2, 3]))
    expect(second.bytes).toEqual(first.bytes)
    expect(fetcher).toHaveBeenCalledTimes(3)
    expect(JSON.stringify(first)).not.toContain('server-only-key')
  })

  it('returns dynamic copyright and maximum zoom for a viewport', async () => {
    const fetcher = vi.fn(async (input: URL | RequestInfo) => {
      const url =
        input instanceof URL ? input : new URL(typeof input === 'string' ? input : input.url)
      if (url.pathname === '/v1/createSession') {
        return new Response(JSON.stringify({ session: 's2' }))
      }
      expect(url.pathname).toBe('/tile/v1/viewport')
      expect(url.searchParams.get('north')).toBe('21')
      return new Response(
        JSON.stringify({ copyright: 'Map data © Google', maxZoomRects: [{ maxZoom: 20 }] }),
      )
    })
    const provider = new GoogleMapTilesProvider('key', 1000, fetcher)

    await expect(
      provider.getViewport({ east: 105, north: 21, south: 20, west: 104, zoom: 11 }),
    ).resolves.toEqual({ attribution: 'Map data © Google', maxZoom: 20 })
  })

  it('normalizes quota errors without retaining the upstream response', async () => {
    const provider = new GoogleMapTilesProvider(
      'key',
      1000,
      vi.fn(async () => new Response('{}', { status: 429 })),
    )
    await expect(provider.getTile(1, 0, 0)).rejects.toMatchObject({
      code: 'GOOGLE_MAP_TILES_QUOTA',
      statusCode: 503,
    })
  })
})
