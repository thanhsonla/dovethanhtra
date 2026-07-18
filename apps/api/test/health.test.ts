import { afterEach, describe, expect, it } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

import { healthRoutes } from '../src/modules/health/health-routes.js'

const apps: FastifyInstance[] = []

async function buildHealthApp(databaseReady: boolean, storageReady: boolean) {
  const app = Fastify()
  await app.register(healthRoutes, {
    dependencies: {
      database: { check: async () => databaseReady },
      objectStorage: { check: async () => storageReady },
    },
    prefix: '/api/v1/health',
  })
  return app
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()))
})

describe('health endpoints', () => {
  it('reports liveness without external dependencies', async () => {
    const app = await buildHealthApp(true, true)
    apps.push(app)

    const response = await app.inject({ method: 'GET', url: '/api/v1/health/live' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: 'ok' })
  })

  it('reports ready only when database and object storage are ready', async () => {
    const app = await buildHealthApp(true, false)
    apps.push(app)

    const response = await app.inject({ method: 'GET', url: '/api/v1/health/ready' })

    expect(response.statusCode).toBe(503)
    expect(response.json()).toEqual({
      status: 'not_ready',
      checks: { database: true, objectStorage: false },
    })
  })
})
