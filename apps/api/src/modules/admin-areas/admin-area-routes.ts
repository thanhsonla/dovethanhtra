import { AdminAreaBoundarySchema, AdminAreaSchema } from '@dove/contracts'
import { Type } from '@sinclair/typebox'
import type { FastifyPluginAsync } from 'fastify'

import type { AuthGuards } from '../identity/auth-guards.js'
import type { AdminAreaRepository } from './admin-area-repository.js'

interface AdminAreaRouteOptions {
  guards: AuthGuards
  repository: AdminAreaRepository
}

export const adminAreaRoutes: FastifyPluginAsync<AdminAreaRouteOptions> = async (app, options) => {
  app.get(
    '/boundaries',
    {
      preHandler: options.guards.requireUser,
      schema: { response: { 200: Type.Array(AdminAreaBoundarySchema) }, tags: ['admin-areas'] },
    },
    async () => options.repository.listCurrentCommuneBoundaries(),
  )
  app.get(
    '/',
    {
      preHandler: options.guards.requireUser,
      schema: { response: { 200: Type.Array(AdminAreaSchema) }, tags: ['admin-areas'] },
    },
    async () => options.repository.list(),
  )
}
