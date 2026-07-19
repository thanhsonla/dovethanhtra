import { Type } from '@sinclair/typebox'
import { ExportJobSchema } from '@dove/contracts'
import type { FastifyPluginAsync, FastifyRequest } from 'fastify'

import { AppError } from '../../platform/app-error.js'
import type { AuthGuards } from '../identity/auth-guards.js'
import type { ExportService } from './export-service.js'

const Params = Type.Object({ caseId: Type.String({ format: 'uuid' }) })
const JobParams = Type.Object({ exportId: Type.String({ format: 'uuid' }) })
const QueueParams = Type.Object({
  caseId: Type.String({ format: 'uuid' }),
  format: Type.Union([Type.Literal('xlsx'), Type.Literal('geojson')]),
})
const ownerId = (request: FastifyRequest) => {
  if (!request.currentUser) throw new AppError(401, 'AUTH_REQUIRED', 'Bạn cần đăng nhập.')
  return request.currentUser.id
}

export const exportRoutes: FastifyPluginAsync<{
  guards: AuthGuards
  service: ExportService
}> = async (app, options) => {
  app.post<{ Params: { caseId: string; format: 'geojson' | 'xlsx' } }>(
    '/cases/:caseId/export-jobs/:format',
    {
      preHandler: options.guards.requireMutation,
      schema: { params: QueueParams, response: { 202: ExportJobSchema }, tags: ['exports'] },
    },
    async (request, reply) =>
      reply
        .code(202)
        .send(
          await options.service.enqueue(
            request.params.caseId,
            request.params.format,
            ownerId(request),
            request.id,
          ),
        ),
  )
  app.get<{ Params: { exportId: string } }>(
    '/exports/:exportId',
    {
      preHandler: options.guards.requireUser,
      schema: { params: JobParams, response: { 200: ExportJobSchema }, tags: ['exports'] },
    },
    (request) => options.service.getJob(request.params.exportId, ownerId(request)),
  )
  app.get<{ Params: { exportId: string } }>(
    '/exports/:exportId/download',
    {
      preHandler: options.guards.requireUser,
      schema: { params: JobParams, tags: ['exports'] },
    },
    async (request, reply) => {
      const result = await options.service.download(request.params.exportId, ownerId(request))
      return reply
        .header(
          'content-type',
          result.format === 'xlsx'
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : 'application/geo+json',
        )
        .header('content-disposition', `attachment; filename="${result.fileName}"`)
        .header('x-file-sha256', result.fileHash!)
        .send(result.stream)
    },
  )
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
