import Fastify, { type FastifyInstance } from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { basemapRoutes } from '../src/modules/basemaps/basemap-routes.js'
import type { GoogleMapTiles } from '../src/modules/basemaps/google-map-tiles-provider.js'

const guards = {
  requireCatalogAdmin: async () => undefined,
  requireMutation: async () => undefined,
  requireUser: async () => undefined,
}

const provider: GoogleMapTiles = {
  getTile: vi.fn(async () => ({ bytes: Buffer.from([1, 2]), contentType: 'image/png' })),
  getViewport: vi.fn(async () => ({ attribution: 'Map data © Google', maxZoom: 20 })),
}

const apps: FastifyInstance[] = []
afterEach(async () => {
  await Promise.all(apps.splice(0).map(async (app) => app.close()))
})

async function build(googleMapTiles: GoogleMapTiles | null) {
  const app = Fastify({ logger: false })
  apps.push(app)
  await app.register(basemapRoutes, { googleMapTiles, guards, prefix: '/api/v1/basemaps' })
  return app
}

describe('basemap routes', () => {
  it('reports capabilities and returns non-cacheable binary tiles', async () => {
    const app = await build(provider)
    const capabilities = await app.inject({ method: 'GET', url: '/api/v1/basemaps' })
    const tile = await app.inject({ method: 'GET', url: '/api/v1/basemaps/google/tiles/1/1/1' })

    expect(capabilities.json()).toEqual({ googleMapTiles: true })
    expect(tile.statusCode).toBe(200)
    expect(tile.headers['cache-control']).toBe('private, no-store')
    expect(tile.headers['content-type']).toContain('image/png')
  })

  it('rejects unavailable providers and invalid tile coordinates', async () => {
    const unavailable = await build(null)
    expect(
      (await unavailable.inject({ method: 'GET', url: '/api/v1/basemaps/google/tiles/1/0/0' }))
        .statusCode,
    ).toBe(404)

    const app = await build(provider)
    expect(
      (await app.inject({ method: 'GET', url: '/api/v1/basemaps/google/tiles/1/2/0' })).statusCode,
    ).toBe(400)
  })
})
