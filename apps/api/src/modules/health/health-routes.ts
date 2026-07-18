import {
  LivenessResponseSchema,
  ReadinessResponseSchema,
  type LivenessResponse,
} from '@dove/contracts'
import type { FastifyPluginAsync } from 'fastify'

import type { ReadinessDependencies } from './health-service.js'
import { createHealthService } from './health-service.js'

export interface HealthRouteOptions {
  dependencies: ReadinessDependencies
}

export const healthRoutes: FastifyPluginAsync<HealthRouteOptions> = async (app, options) => {
  const service = createHealthService(options.dependencies)

  app.get<{ Reply: LivenessResponse }>(
    '/live',
    {
      schema: {
        response: { 200: LivenessResponseSchema },
        tags: ['health'],
      },
    },
    async () => ({ status: 'ok' }),
  )

  app.get(
    '/ready',
    {
      schema: {
        response: {
          200: ReadinessResponseSchema,
          503: ReadinessResponseSchema,
        },
        tags: ['health'],
      },
    },
    async (_request, reply) => {
      const result = await service.readiness()
      return reply.code(result.status === 'ready' ? 200 : 503).send(result)
    },
  )
}
