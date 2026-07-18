import type { CurrentUser } from '@dove/contracts'

declare module 'fastify' {
  interface FastifyRequest {
    currentUser?: CurrentUser
  }
}
