import {
  CreateManagementZoneRequestSchema,
  ManagementZoneSchema,
  RestoreRecordRequestSchema,
  UpdateManagementZoneRequestSchema,
  type CreateManagementZoneRequest,
  type RestoreRecordRequest,
  type UpdateManagementZoneRequest,
} from '@dove/contracts'
import { Type } from '@sinclair/typebox'
import type { FastifyPluginAsync, FastifyRequest } from 'fastify'

import { AppError } from '../../platform/app-error.js'
import type { AuthGuards } from '../identity/auth-guards.js'
import type { ManagementZoneService } from './management-zone-service.js'

const Params = Type.Object({ id: Type.String({ format: 'uuid' }) })
const Query = Type.Object({ includeDeleted: Type.Optional(Type.Boolean()) })

function actor(request: FastifyRequest) {
  if (!request.currentUser) throw new AppError(401, 'AUTH_REQUIRED', 'Bạn cần đăng nhập.')
  return request.currentUser.id
}

function version(header: string | string[] | undefined) {
  const value = Array.isArray(header) ? header[0] : header
  const match = value?.match(/^(?:W\/)?"?(\d+)"?$/)
  if (!match) throw new AppError(428, 'IF_MATCH_REQUIRED', 'Yêu cầu phải gửi If-Match.')
  return Number(match[1])
}

export const managementZoneRoutes: FastifyPluginAsync<{
  guards: AuthGuards
  service: ManagementZoneService
}> = async (app, options) => {
  app.get<{ Querystring: { includeDeleted?: boolean } }>(
    '/',
    {
      preHandler: options.guards.requireUser,
      schema: {
        querystring: Query,
        response: { 200: Type.Array(ManagementZoneSchema) },
        tags: ['catalog'],
      },
    },
    (request) => options.service.list(request.query.includeDeleted ?? false),
  )

  app.post<{ Body: CreateManagementZoneRequest }>(
    '/',
    {
      preHandler: options.guards.requireCatalogAdmin,
      schema: {
        body: CreateManagementZoneRequestSchema,
        response: { 201: ManagementZoneSchema },
        tags: ['catalog'],
      },
    },
    async (request, reply) => {
      const created = await options.service.create(request.body, actor(request), request.id)
      return reply.header('etag', `"${created.version}"`).code(201).send(created)
    },
  )

  app.patch<{ Body: UpdateManagementZoneRequest; Params: { id: string } }>(
    '/:id',
    {
      preHandler: options.guards.requireCatalogAdmin,
      schema: {
        body: UpdateManagementZoneRequestSchema,
        params: Params,
        response: { 200: ManagementZoneSchema },
        tags: ['catalog'],
      },
    },
    async (request, reply) => {
      const updated = await options.service.update(
        request.params.id,
        version(request.headers['if-match']),
        request.body,
        actor(request),
        request.id,
      )
      return reply.header('etag', `"${updated.version}"`).send(updated)
    },
  )

  app.delete<{ Body: RestoreRecordRequest; Params: { id: string } }>(
    '/:id',
    {
      preHandler: options.guards.requireCatalogAdmin,
      schema: {
        body: RestoreRecordRequestSchema,
        params: Params,
        response: { 200: ManagementZoneSchema },
        tags: ['catalog'],
      },
    },
    async (request, reply) => {
      const deleted = await options.service.remove(
        request.params.id,
        version(request.headers['if-match']),
        request.body.reason,
        actor(request),
        request.id,
      )
      return reply.header('etag', `"${deleted.version}"`).send(deleted)
    },
  )

  app.post<{ Body: RestoreRecordRequest; Params: { id: string } }>(
    '/:id/restore',
    {
      preHandler: options.guards.requireCatalogAdmin,
      schema: {
        body: RestoreRecordRequestSchema,
        params: Params,
        response: { 200: ManagementZoneSchema },
        tags: ['catalog'],
      },
    },
    async (request, reply) => {
      const restored = await options.service.restore(
        request.params.id,
        version(request.headers['if-match']),
        request.body.reason,
        actor(request),
        request.id,
      )
      return reply.header('etag', `"${restored.version}"`).send(restored)
    },
  )
}
