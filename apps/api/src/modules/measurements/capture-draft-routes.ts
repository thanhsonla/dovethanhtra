import {
  CaptureDraftMutationResponseSchema,
  CaptureDraftSchema,
  CaptureDraftStatusSchema,
  ClassifyCaptureDraftRequestSchema,
  ClassifyCaptureDraftResponseSchema,
  CreateCaptureDraftRequestSchema,
  RestoreRecordRequestSchema,
  UpdateCaptureDraftRequestSchema,
  type CaptureDraftStatus,
  type ClassifyCaptureDraftRequest,
  type CreateCaptureDraftRequest,
  type RestoreRecordRequest,
  type UpdateCaptureDraftRequest,
} from '@dove/contracts'
import { Type } from '@sinclair/typebox'
import type { FastifyPluginAsync, FastifyRequest } from 'fastify'

import { AppError } from '../../platform/app-error.js'
import type { AuthGuards } from '../identity/auth-guards.js'
import type { CaptureDraftService } from './capture-draft-service.js'

const CaseParams = Type.Object({ caseId: Type.String({ format: 'uuid' }) })
const DraftParams = Type.Object({ draftId: Type.String({ format: 'uuid' }) })

function owner(request: FastifyRequest) {
  if (!request.currentUser) throw new AppError(401, 'AUTH_REQUIRED', 'Bạn cần đăng nhập.')
  return request.currentUser.id
}

function requiredHeader(header: string | string[] | undefined, name: string) {
  const value = Array.isArray(header) ? header[0] : header
  if (!value?.trim() || value.length > 200) {
    throw new AppError(400, 'SYNC_HEADER_REQUIRED', `Thiếu hoặc sai header ${name}.`)
  }
  return value
}

function version(header: string | string[] | undefined) {
  const raw = Array.isArray(header) ? header[0] : header
  const match = raw?.match(/^(?:W\/)?"?(\d+)"?$/)
  if (!match) throw new AppError(428, 'IF_MATCH_REQUIRED', 'Yêu cầu phải gửi If-Match.')
  return Number(match[1])
}

export const captureDraftRoutes: FastifyPluginAsync<{
  guards: AuthGuards
  service: CaptureDraftService
}> = async (app, options) => {
  app.get<{
    Params: { caseId: string }
    Querystring: { includeDeleted?: boolean; limit?: number; status?: CaptureDraftStatus }
  }>(
    '/cases/:caseId/capture-drafts',
    {
      preHandler: options.guards.requireUser,
      schema: {
        params: CaseParams,
        querystring: Type.Object({
          includeDeleted: Type.Optional(Type.Boolean()),
          limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 500 })),
          status: Type.Optional(CaptureDraftStatusSchema),
        }),
        response: { 200: Type.Array(CaptureDraftSchema) },
        tags: ['measurements'],
      },
    },
    (request) =>
      options.service.list(request.params.caseId, owner(request), {
        includeDeleted: request.query.includeDeleted ?? false,
        limit: request.query.limit ?? 200,
        ...(request.query.status ? { status: request.query.status } : {}),
      }),
  )

  app.post<{ Body: CreateCaptureDraftRequest; Params: { caseId: string } }>(
    '/cases/:caseId/capture-drafts',
    {
      preHandler: options.guards.requireMutation,
      schema: {
        body: CreateCaptureDraftRequestSchema,
        params: CaseParams,
        response: {
          200: CaptureDraftMutationResponseSchema,
          201: CaptureDraftMutationResponseSchema,
        },
        tags: ['measurements'],
      },
    },
    async (request, reply) => {
      const result = await options.service.create(
        request.params.caseId,
        request.body,
        owner(request),
        requiredHeader(request.headers['x-device-id'], 'X-Device-Id'),
        requiredHeader(request.headers['idempotency-key'], 'Idempotency-Key'),
        request.id,
      )
      return reply
        .header('etag', `"${result.draft.version}"`)
        .code(result.idempotentReplay ? 200 : 201)
        .send(result)
    },
  )

  app.get<{ Params: { draftId: string } }>(
    '/capture-drafts/:draftId',
    {
      preHandler: options.guards.requireUser,
      schema: {
        params: DraftParams,
        response: { 200: CaptureDraftSchema },
        tags: ['measurements'],
      },
    },
    async (request, reply) => {
      const draft = await options.service.get(request.params.draftId, owner(request))
      return reply.header('etag', `"${draft.version}"`).send(draft)
    },
  )

  app.patch<{ Body: UpdateCaptureDraftRequest; Params: { draftId: string } }>(
    '/capture-drafts/:draftId',
    {
      preHandler: options.guards.requireMutation,
      schema: {
        body: UpdateCaptureDraftRequestSchema,
        params: DraftParams,
        response: { 200: CaptureDraftSchema },
        tags: ['measurements'],
      },
    },
    async (request, reply) => {
      const draft = await options.service.update(
        request.params.draftId,
        version(request.headers['if-match']),
        request.body,
        owner(request),
        request.id,
      )
      return reply.header('etag', `"${draft.version}"`).send(draft)
    },
  )

  app.delete<{ Body: RestoreRecordRequest; Params: { draftId: string } }>(
    '/capture-drafts/:draftId',
    {
      preHandler: options.guards.requireMutation,
      schema: {
        body: RestoreRecordRequestSchema,
        params: DraftParams,
        response: { 200: CaptureDraftSchema },
        tags: ['measurements'],
      },
    },
    async (request, reply) => {
      const draft = await options.service.setDeleted(
        request.params.draftId,
        version(request.headers['if-match']),
        request.body.reason,
        owner(request),
        request.id,
        false,
      )
      return reply.header('etag', `"${draft.version}"`).send(draft)
    },
  )

  app.post<{ Body: RestoreRecordRequest; Params: { draftId: string } }>(
    '/capture-drafts/:draftId/restore',
    {
      preHandler: options.guards.requireMutation,
      schema: {
        body: RestoreRecordRequestSchema,
        params: DraftParams,
        response: { 200: CaptureDraftSchema },
        tags: ['measurements'],
      },
    },
    async (request, reply) => {
      const draft = await options.service.setDeleted(
        request.params.draftId,
        version(request.headers['if-match']),
        request.body.reason,
        owner(request),
        request.id,
        true,
      )
      return reply.header('etag', `"${draft.version}"`).send(draft)
    },
  )

  app.post<{ Body: ClassifyCaptureDraftRequest; Params: { draftId: string } }>(
    '/capture-drafts/:draftId/classify',
    {
      preHandler: options.guards.requireMutation,
      schema: {
        body: ClassifyCaptureDraftRequestSchema,
        params: DraftParams,
        response: {
          201: ClassifyCaptureDraftResponseSchema,
          200: ClassifyCaptureDraftResponseSchema,
        },
        tags: ['measurements'],
      },
    },
    async (request, reply) => {
      const result = await options.service.classify(
        request.params.draftId,
        version(request.headers['if-match']),
        request.body,
        owner(request),
        requiredHeader(request.headers['x-device-id'], 'X-Device-Id'),
        requiredHeader(request.headers['idempotency-key'], 'Idempotency-Key'),
        request.id,
      )
      return reply
        .header('etag', `"${result.draft.version}"`)
        .code(result.idempotentReplay ? 200 : 201)
        .send(result)
    },
  )
}
