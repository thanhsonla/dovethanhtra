import { Type } from '@sinclair/typebox'
import type { FastifyPluginAsync, FastifyRequest } from 'fastify'

import { AppError } from '../../platform/app-error.js'
import type { AuthGuards } from '../identity/auth-guards.js'
import type { ExportService } from './export-service.js'

const Params = Type.Object({ caseId: Type.String({ format: 'uuid' }) })
const ownerId = (request: FastifyRequest) => {
  if (!request.currentUser) throw new AppError(401, 'AUTH_REQUIRED', 'Bạn cần đăng nhập.')
  return request.currentUser.id
}

export const exportRoutes: FastifyPluginAsync<{
  guards: AuthGuards
  service: ExportService
}> = async (app, options) => {
  for (const format of ['xlsx', 'geojson'] as const) {
    const path = format === 'xlsx' ? 'excel' : 'geojson'
    app.post<{ Params: { caseId: string } }>(
      `/cases/:caseId/exports/${path}`,
      {
        preHandler: options.guards.requireMutation,
        schema: { params: Params, tags: ['exports'] },
      },
      async (request, reply) => {
        const result = await options.service.create(
          request.params.caseId,
          format,
          ownerId(request),
          request.id,
        )
        return reply
          .header('content-type', result.contentType)
          .header('content-disposition', `attachment; filename="${result.fileName}"`)
          .header('x-export-id', result.exportId)
          .header('x-file-sha256', result.fileHash)
          .send(result.bytes)
      },
    )
  }
}
