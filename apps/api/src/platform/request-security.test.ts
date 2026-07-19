import Fastify, { type FastifyInstance } from 'fastify'
import { afterEach, describe, expect, it } from 'vitest'

import { registerSecurityHeaders, SlidingWindowRateLimiter } from './request-security.js'

const apps = new Set<FastifyInstance>()

afterEach(async () => {
  await Promise.all([...apps].map((app) => app.close()))
  apps.clear()
})

describe('request security', () => {
  it('limits a key within a moving window and releases it after expiry', () => {
    const limiter = new SlidingWindowRateLimiter(2, 1_000)
    expect(limiter.consume('client', 1_000)).toBe(true)
    expect(limiter.consume('client', 1_500)).toBe(true)
    expect(limiter.consume('client', 1_999)).toBe(false)
    expect(limiter.consume('client', 2_001)).toBe(true)
  })

  it('sets defensive API headers and HSTS only for secure transport', async () => {
    const app = Fastify()
    apps.add(app)
    registerSecurityHeaders(app, true)
    app.get('/api/v1/example', () => ({ ok: true }))
    const response = await app.inject({ method: 'GET', url: '/api/v1/example' })
    expect(response.headers).toMatchObject({
      'cache-control': 'private, no-store',
      'content-security-policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
      'strict-transport-security': 'max-age=31536000; includeSubDomains',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
    })
  })
})
