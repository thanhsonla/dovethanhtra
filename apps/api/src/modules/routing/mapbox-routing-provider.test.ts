import { afterEach, describe, expect, it, vi } from 'vitest'

import { MapboxRoutingProvider } from './mapbox-routing-provider.js'

const request = {
  origin: [104.65, 20.8] as [number, number],
  destination: [104.72, 20.82] as [number, number],
  waypoints: [],
  profile: 'driving' as const,
}

afterEach(() => vi.unstubAllGlobals())

describe('Mapbox routing adapter', () => {
  it('maps a Directions v5 response without retaining the token', async () => {
    const fetchMock = vi.fn(async (url: URL) => {
      expect(url.searchParams.get('access_token')).toBe('test-token')
      return new Response(
        JSON.stringify({
          code: 'Ok',
          routes: [
            {
              distance: 1234,
              duration: 120,
              geometry: { type: 'LineString', coordinates: [request.origin, request.destination] },
              legs: [{ distance: 1234, duration: 120 }],
            },
          ],
        }),
        { status: 200 },
      )
    })
    vi.stubGlobal('fetch', fetchMock)
    const result = await new MapboxRoutingProvider('test-token', 1000).calculate(request)
    expect(result.candidates[0]).toMatchObject({ distanceM: 1234, durationS: 120 })
    expect(JSON.stringify(result)).not.toContain('test-token')
  })

  it('normalizes quota, timeout and no-route failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 429 })),
    )
    await expect(new MapboxRoutingProvider('x', 10).calculate(request)).rejects.toMatchObject({
      code: 'ROUTING_QUOTA_EXCEEDED',
    })

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new DOMException('timeout', 'TimeoutError')
      }),
    )
    await expect(new MapboxRoutingProvider('x', 10).calculate(request)).rejects.toMatchObject({
      code: 'ROUTING_TIMEOUT',
    })

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ code: 'NoRoute' }), { status: 200 })),
    )
    await expect(new MapboxRoutingProvider('x', 10).calculate(request)).rejects.toMatchObject({
      code: 'ROUTE_NOT_FOUND',
    })
  })
})
