import {
  CaseMapContextSchema,
  CaseListResponseSchema,
  CaseStatusSchema,
  CreateCaseRequestSchema,
  CreateWorkItemRequestSchema,
  InspectionCaseSchema,
  WorkItemSchema,
  type CaseStatus,
  type CreateCaseRequest,
  type CreateWorkItemRequest,
  type UpdateCaseRequest,
  UpdateCaseRequestSchema,
} from '@dove/contracts'
import { Type } from '@sinclair/typebox'
import type { FastifyPluginAsync, FastifyRequest } from 'fastify'

import { AppError } from '../../platform/app-error.js'
import type { AuthGuards } from '../identity/auth-guards.js'
import type { CaseService } from './case-service.js'

interface CaseRouteOptions {
  guards: AuthGuards
  service: CaseService
}

const CaseParams = Type.Object({ caseId: Type.String({ format: 'uuid' }) })

function ownerId(request: FastifyRequest): string {
  if (!request.currentUser) throw new AppError(401, 'AUTH_REQUIRED', 'Bạn cần đăng nhập.')
  return request.currentUser.id
}

function expectedVersion(header: string | string[] | undefined): number {
  const raw = Array.isArray(header) ? header[0] : header
  const matched = raw?.match(/^(?:W\/)?"?(\d+)"?$/)
  if (!matched) {
    throw new AppError(
      428,
      'IF_MATCH_REQUIRED',
      'Yêu cầu sửa phải gửi If-Match với phiên bản hồ sơ.',
    )
  }
  return Number(matched[1])
}

export const caseRoutes: FastifyPluginAsync<CaseRouteOptions> = async (app, options) => {
  app.get<{
    Querystring: { limit?: number; search?: string; status?: CaseStatus }
  }>(
    '/',
    {
      preHandler: options.guards.requireUser,
      schema: {
        querystring: Type.Object({
          limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
          search: Type.Optional(Type.String({ maxLength: 200 })),
          status: Type.Optional(CaseStatusSchema),
        }),
        response: { 200: CaseListResponseSchema },
        tags: ['cases'],
      },
    },
    async (request) => ({
      items: await options.service.list(ownerId(request), {
        limit: request.query.limit ?? 50,
        ...(request.query.search ? { search: request.query.search } : {}),
        ...(request.query.status ? { status: request.query.status } : {}),
      }),
      nextCursor: null,
    }),
  )

  app.post<{ Body: CreateCaseRequest }>(
    '/',
    {
      preHandler: options.guards.requireMutation,
      schema: {
        body: CreateCaseRequestSchema,
        response: { 201: InspectionCaseSchema },
        tags: ['cases'],
      },
    },
    async (request, reply) => {
      const created = await options.service.create(request.body, ownerId(request), request.id)
      reply.header('etag', `"${created.version}"`)
      return reply.code(201).send(created)
    },
  )

  app.get<{ Params: { caseId: string } }>(
    '/:caseId',
    {
      preHandler: options.guards.requireUser,
      schema: {
        params: CaseParams,
        response: { 200: InspectionCaseSchema },
        tags: ['cases'],
      },
    },
    async (request, reply) => {
      const found = await options.service.get(request.params.caseId, ownerId(request))
      reply.header('etag', `"${found.version}"`)
      return found
    },
  )

  app.get<{ Params: { caseId: string } }>(
    '/:caseId/map-context',
    {
      preHandler: options.guards.requireUser,
      schema: {
        params: CaseParams,
        response: { 200: CaseMapContextSchema },
        tags: ['cases'],
      },
    },
    (request) => options.service.getMapContext(request.params.caseId, ownerId(request)),
  )

  app.patch<{ Body: UpdateCaseRequest; Params: { caseId: string } }>(
    '/:caseId',
    {
      preHandler: options.guards.requireMutation,
      schema: {
        body: UpdateCaseRequestSchema,
        params: CaseParams,
        response: { 200: InspectionCaseSchema },
        tags: ['cases'],
      },
    },
    async (request, reply) => {
      const updated = await options.service.update(
        request.params.caseId,
        expectedVersion(request.headers['if-match']),
        request.body,
        ownerId(request),
        request.id,
      )
      reply.header('etag', `"${updated.version}"`)
      return updated
    },
  )

  app.delete<{ Params: { caseId: string } }>(
    '/:caseId',
    {
      preHandler: options.guards.requireMutation,
      schema: { params: CaseParams, tags: ['cases'] },
    },
    async (request, reply) => {
      await options.service.remove(request.params.caseId, ownerId(request), request.id)
      return reply.code(204).send()
    },
  )

  app.get<{ Params: { caseId: string } }>(
    '/:caseId/work-items',
    {
      preHandler: options.guards.requireUser,
      schema: {
        params: CaseParams,
        response: { 200: Type.Array(WorkItemSchema) },
        tags: ['cases'],
      },
    },
    (request) => options.service.listWorkItems(request.params.caseId, ownerId(request)),
  )

  app.post<{ Body: CreateWorkItemRequest; Params: { caseId: string } }>(
    '/:caseId/work-items',
    {
      preHandler: options.guards.requireMutation,
      schema: {
        body: CreateWorkItemRequestSchema,
        params: CaseParams,
        response: { 201: WorkItemSchema },
        tags: ['cases'],
      },
    },
    async (request, reply) => {
      const created = await options.service.createWorkItem(
        request.params.caseId,
        request.body,
        ownerId(request),
        request.id,
      )
      return reply.code(201).send(created)
    },
  )
}
