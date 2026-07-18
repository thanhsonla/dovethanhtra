import {
  CreateServiceGroupRequestSchema,
  CreateWorkTypeRequestSchema,
  ServiceGroupSchema,
  UpdateServiceGroupRequestSchema,
  UpdateWorkTypeRequestSchema,
  WorkTypeSchema,
  type CreateServiceGroupRequest,
  type CreateWorkTypeRequest,
  type UpdateServiceGroupRequest,
  type UpdateWorkTypeRequest,
} from '@dove/contracts'
import { Type } from '@sinclair/typebox'
import type { FastifyPluginAsync, FastifyRequest } from 'fastify'

import { AppError } from '../../platform/app-error.js'
import type { AuthGuards } from '../identity/auth-guards.js'
import type { CatalogService } from './catalog-service.js'

interface CatalogRouteOptions {
  guards: AuthGuards
  service: CatalogService
}

const IdParams = Type.Object({ id: Type.String({ format: 'uuid' }) })
const ListQuery = Type.Object({ includeInactive: Type.Optional(Type.Boolean()) })

function actor(request: FastifyRequest) {
  if (!request.currentUser) throw new AppError(401, 'AUTH_REQUIRED', 'Bạn cần đăng nhập.')
  return request.currentUser
}

export const catalogRoutes: FastifyPluginAsync<CatalogRouteOptions> = async (app, options) => {
  app.get<{ Querystring: { includeInactive?: boolean } }>(
    '/service-groups',
    {
      preHandler: options.guards.requireUser,
      schema: {
        querystring: ListQuery,
        response: { 200: Type.Array(ServiceGroupSchema) },
        tags: ['catalog'],
      },
    },
    (request) => options.service.listServiceGroups(request.query.includeInactive ?? false),
  )

  app.post<{ Body: CreateServiceGroupRequest }>(
    '/service-groups',
    {
      preHandler: options.guards.requireCatalogAdmin,
      schema: {
        body: CreateServiceGroupRequestSchema,
        response: { 201: ServiceGroupSchema },
        tags: ['catalog'],
      },
    },
    async (request, reply) => {
      const created = await options.service.createServiceGroup(
        request.body,
        actor(request).id,
        request.id,
      )
      return reply.code(201).send(created)
    },
  )

  app.patch<{ Body: UpdateServiceGroupRequest; Params: { id: string } }>(
    '/service-groups/:id',
    {
      preHandler: options.guards.requireCatalogAdmin,
      schema: {
        body: UpdateServiceGroupRequestSchema,
        params: IdParams,
        response: { 200: ServiceGroupSchema },
        tags: ['catalog'],
      },
    },
    (request) =>
      options.service.updateServiceGroup(
        request.params.id,
        request.body,
        actor(request).id,
        request.id,
      ),
  )

  app.get<{ Querystring: { includeInactive?: boolean } }>(
    '/work-types',
    {
      preHandler: options.guards.requireUser,
      schema: {
        querystring: ListQuery,
        response: { 200: Type.Array(WorkTypeSchema) },
        tags: ['catalog'],
      },
    },
    (request) => options.service.listWorkTypes(request.query.includeInactive ?? false),
  )

  app.post<{ Body: CreateWorkTypeRequest }>(
    '/work-types',
    {
      preHandler: options.guards.requireCatalogAdmin,
      schema: {
        body: CreateWorkTypeRequestSchema,
        response: { 201: WorkTypeSchema },
        tags: ['catalog'],
      },
    },
    async (request, reply) => {
      const created = await options.service.createWorkType(
        request.body,
        actor(request).id,
        request.id,
      )
      return reply.code(201).send(created)
    },
  )

  app.patch<{ Body: UpdateWorkTypeRequest; Params: { id: string } }>(
    '/work-types/:id',
    {
      preHandler: options.guards.requireCatalogAdmin,
      schema: {
        body: UpdateWorkTypeRequestSchema,
        params: IdParams,
        response: { 200: WorkTypeSchema },
        tags: ['catalog'],
      },
    },
    (request) =>
      options.service.updateWorkType(
        request.params.id,
        request.body,
        actor(request).id,
        request.id,
      ),
  )
}
