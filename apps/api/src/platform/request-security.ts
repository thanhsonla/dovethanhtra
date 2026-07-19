import type { FastifyInstance } from 'fastify'

export class SlidingWindowRateLimiter {
  private readonly requests = new Map<string, number[]>()

  constructor(
    private readonly limit: number,
    private readonly windowMs = 60_000,
  ) {}

  consume(key: string, now = Date.now()): boolean {
    const cutoff = now - this.windowMs
    const current = (this.requests.get(key) ?? []).filter((time) => time > cutoff)
    if (current.length >= this.limit) return false
    current.push(now)
    this.requests.set(key, current)
    return true
  }
}

export function registerSecurityHeaders(app: FastifyInstance, secureTransport: boolean) {
  app.addHook('onSend', (request, reply, payload, done) => {
    const contentSecurityPolicy = request.url.startsWith('/documentation')
      ? "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'"
      : "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
    reply.headers({
      'cache-control': request.url.startsWith('/api/') ? 'private, no-store' : 'no-cache',
      'content-security-policy': contentSecurityPolicy,
      'cross-origin-resource-policy': 'same-origin',
      'permissions-policy': 'camera=(self), geolocation=(self), microphone=()',
      'referrer-policy': 'no-referrer',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
    })
    if (secureTransport)
      reply.header('strict-transport-security', 'max-age=31536000; includeSubDomains')
    done(null, payload)
  })
}
