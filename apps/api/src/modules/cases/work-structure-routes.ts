import {
  CreateWorkComponentRequestSchema,
  RestoreRecordRequestSchema,
  UpdateWorkComponentRequestSchema,
  UpdateWorkItemRequestSchema,
  WorkComponentSchema,
  WorkItemSchema,
  type CreateWorkComponentRequest,
  type RestoreRecordRequest,
  type UpdateWorkComponentRequest,
  type UpdateWorkItemRequest,
} from '@dove/contracts'
import { Type } from '@sinclair/typebox'
import type { FastifyPluginAsync, FastifyRequest } from 'fastify'

import { AppError } from '../../platform/app-error.js'
import type { AuthGuards } from '../identity/auth-guards.js'
import type { WorkStructureService } from './work-structure-service.js'

const WorkParams = Type.Object({ workItemId: Type.String({ format: 'uuid' }) })
const ComponentParams = Type.Object({ componentId: Type.String({ format: 'uuid' }) })

function owner(request: FastifyRequest) {
  if (!request.currentUser) throw new AppError(401, 'AUTH_REQUIRED', 'Bạn cần đăng nhập.')
  return request.currentUser.id
}
function version(header: string | string[] | undefined) {
  const raw = Array.isArray(header) ? header[0] : header
  const match = raw?.match(/^(?:W\/)?"?(\d+)"?$/)
  if (!match) throw new AppError(428, 'IF_MATCH_REQUIRED', 'Yêu cầu phải gửi If-Match.')
  return Number(match[1])
}

export const workStructureRoutes: FastifyPluginAsync<{
  guards: AuthGuards
  service: WorkStructureService
}> = async (app, options) => {
  app.patch<{ Body: UpdateWorkItemRequest; Params: { workItemId: string } }>(
    '/work-items/:workItemId',
    {
      preHandler: options.guards.requireMutation,
      schema: {
        body: UpdateWorkItemRequestSchema,
        params: WorkParams,
        response: { 200: WorkItemSchema },
        tags: ['cases'],
      },
    },
    async (request, reply) => {
      const updated = await options.service.updateItem(
        request.params.workItemId,
        version(request.headers['if-match']),
        request.body,
        owner(request),
        request.id,
      )
      return reply.header('etag', `"${updated.version}"`).send(updated)
    },
  )

  app.delete<{ Body: RestoreRecordRequest; Params: { workItemId: string } }>(
    '/work-items/:workItemId',
    {
      preHandler: options.guards.requireMutation,
      schema: {
        body: RestoreRecordRequestSchema,
        params: WorkParams,
        response: { 200: WorkItemSchema },
        tags: ['cases'],
      },
    },
    async (request, reply) => {
      const deleted = await options.service.removeItem(
        request.params.workItemId,
        version(request.headers['if-match']),
        request.body.reason,
        owner(request),
        request.id,
      )
      return reply.header('etag', `"${deleted.version}"`).send(deleted)
    },
  )

  app.post<{ Body: RestoreRecordRequest; Params: { workItemId: string } }>(
    '/work-items/:workItemId/restore',
    {
      preHandler: options.guards.requireMutation,
      schema: {
        body: RestoreRecordRequestSchema,
        params: WorkParams,
        response: { 200: WorkItemSchema },
        tags: ['cases'],
      },
    },
    async (request, reply) => {
      const restored = await options.service.restoreItem(
        request.params.workItemId,
        version(request.headers['if-match']),
        request.body.reason,
        owner(request),
        request.id,
      )
      return reply.header('etag', `"${restored.version}"`).send(restored)
    },
  )

  app.get<{ Params: { workItemId: string }; Querystring: { includeDeleted?: boolean } }>(
    '/work-items/:workItemId/components',
    {
      preHandler: options.guards.requireUser,
      schema: {
        params: WorkParams,
        querystring: Type.Object({ includeDeleted: Type.Optional(Type.Boolean()) }),
        response: { 200: Type.Array(WorkComponentSchema) },
        tags: ['cases'],
      },
    },
    (request) =>
      options.service.listComponents(
        request.params.workItemId,
        owner(request),
        request.query.includeDeleted ?? false,
      ),
  )

  app.post<{ Body: CreateWorkComponentRequest; Params: { workItemId: string } }>(
    '/work-items/:workItemId/components',
    {
      preHandler: options.guards.requireMutation,
      schema: {
        body: CreateWorkComponentRequestSchema,
        params: WorkParams,
        response: { 201: WorkComponentSchema },
        tags: ['cases'],
      },
    },
    async (request, reply) => {
      const created = await options.service.createComponent(
        request.params.workItemId,
        request.body,
        owner(request),
        request.id,
      )
      return reply.header('etag', `"${created.version}"`).code(201).send(created)
    },
  )

  app.patch<{ Body: UpdateWorkComponentRequest; Params: { componentId: string } }>(
    '/work-components/:componentId',
    {
      preHandler: options.guards.requireMutation,
      schema: {
        body: UpdateWorkComponentRequestSchema,
        params: ComponentParams,
        response: { 200: WorkComponentSchema },
        tags: ['cases'],
      },
    },
    async (request, reply) => {
      const updated = await options.service.updateComponent(
        request.params.componentId,
        version(request.headers['if-match']),
        request.body,
        owner(request),
        request.id,
      )
      return reply.header('etag', `"${updated.version}"`).send(updated)
    },
  )

  app.delete<{ Body: RestoreRecordRequest; Params: { componentId: string } }>(
    '/work-components/:componentId',
    {
      preHandler: options.guards.requireMutation,
      schema: {
        body: RestoreRecordRequestSchema,
        params: ComponentParams,
        response: { 200: WorkComponentSchema },
        tags: ['cases'],
      },
    },
    async (request, reply) => {
      const deleted = await options.service.setComponentDeleted(
        request.params.componentId,
        version(request.headers['if-match']),
        request.body.reason,
        owner(request),
        request.id,
        false,
      )
      return reply.header('etag', `"${deleted.version}"`).send(deleted)
    },
  )

  app.post<{ Body: RestoreRecordRequest; Params: { componentId: string } }>(
    '/work-components/:componentId/restore',
    {
      preHandler: options.guards.requireMutation,
      schema: {
        body: RestoreRecordRequestSchema,
        params: ComponentParams,
        response: { 200: WorkComponentSchema },
        tags: ['cases'],
      },
    },
    async (request, reply) => {
      const restored = await options.service.setComponentDeleted(
        request.params.componentId,
        version(request.headers['if-match']),
        request.body.reason,
        owner(request),
        request.id,
        true,
      )
      return reply.header('etag', `"${restored.version}"`).send(restored)
    },
  )
}
