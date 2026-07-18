import { AuditEventSchema } from '@dove/contracts'
import { Type } from '@sinclair/typebox'
import type { FastifyPluginAsync } from 'fastify'

import { AppError } from '../../platform/app-error.js'
import type { AuthGuards } from '../identity/auth-guards.js'
import type { AuditRepository } from './audit-repository.js'

interface AuditRouteOptions {
  guards: AuthGuards
  repository: AuditRepository
}

export const auditRoutes: FastifyPluginAsync<AuditRouteOptions> = async (app, options) => {
  app.get<{ Params: { caseId: string } }>(
    '/',
    {
      preHandler: options.guards.requireUser,
      schema: {
        params: Type.Object({ caseId: Type.String({ format: 'uuid' }) }),
        response: { 200: Type.Array(AuditEventSchema) },
        tags: ['audit'],
      },
    },
    async (request) => {
      if (!request.currentUser) throw new AppError(401, 'AUTH_REQUIRED', 'Bạn cần đăng nhập.')
      return options.repository.listForCase(request.params.caseId, request.currentUser.id)
    },
  )
}
