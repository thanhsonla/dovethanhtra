import {
  AttachmentSchema,
  CompleteAttachmentRequestSchema,
  CreateGpsPointRequestSchema,
  CreateGpsTrackRequestSchema,
  GpsPointResponseSchema,
  GpsTrackResponseSchema,
  PresignAttachmentRequestSchema,
  PresignAttachmentResponseSchema,
  type CompleteAttachmentRequest,
  type CreateGpsPointRequest,
  type CreateGpsTrackRequest,
  type PresignAttachmentRequest,
  RestoreRecordRequestSchema,
  type RestoreRecordRequest,
} from '@dove/contracts'
import { Type } from '@sinclair/typebox'
import type { FastifyPluginAsync, FastifyRequest } from 'fastify'

import { AppError } from '../../platform/app-error.js'
import type { AuthGuards } from '../identity/auth-guards.js'
import type { EvidenceService } from './evidence-service.js'
import type { GpsService } from './gps-service.js'

const WorkItemParams = Type.Object({ workItemId: Type.String({ format: 'uuid' }) })
const AttachmentParams = Type.Object({ attachmentId: Type.String({ format: 'uuid' }) })
const ownerId = (request: FastifyRequest) => {
  if (!request.currentUser) throw new AppError(401, 'AUTH_REQUIRED', 'Bạn cần đăng nhập.')
  return request.currentUser.id
}
const header = (request: FastifyRequest, name: string) => {
  const value = request.headers[name]
  if (typeof value !== 'string' || value.length < 8 || value.length > 200) {
    throw new AppError(400, 'SYNC_HEADER_REQUIRED', `Thiếu hoặc sai header ${name}.`)
  }
  return value
}

export const fieldRoutes: FastifyPluginAsync<{
  evidence: EvidenceService
  gps: GpsService
  guards: AuthGuards
}> = async (app, options) => {
  app.get<{ Params: { workItemId: string } }>(
    '/work-items/:workItemId/attachments',
    {
      preHandler: options.guards.requireUser,
      schema: {
        params: WorkItemParams,
        response: { 200: Type.Array(AttachmentSchema) },
        tags: ['field'],
      },
    },
    (request) => options.evidence.listForWork(request.params.workItemId, ownerId(request)),
  )
  app.get<{ Params: { workItemId: string } }>(
    '/work-items/:workItemId/attachments/deleted',
    {
      preHandler: options.guards.requireUser,
      schema: {
        params: WorkItemParams,
        response: { 200: Type.Array(AttachmentSchema) },
        tags: ['field'],
      },
    },
    (request) => options.evidence.listDeletedForWork(request.params.workItemId, ownerId(request)),
  )

  app.post<{ Body: CreateGpsPointRequest; Params: { workItemId: string } }>(
    '/work-items/:workItemId/gps-points',
    {
      preHandler: options.guards.requireMutation,
      schema: {
        body: CreateGpsPointRequestSchema,
        params: WorkItemParams,
        response: { 201: GpsPointResponseSchema, 200: GpsPointResponseSchema },
        tags: ['field'],
      },
    },
    async (request, reply) => {
      const result = await options.gps.createPoint(
        request.params.workItemId,
        request.body,
        ownerId(request),
        header(request, 'x-device-id'),
        header(request, 'idempotency-key'),
        request.id,
      )
      return reply.code(result.idempotentReplay ? 200 : 201).send(result)
    },
  )

  app.post<{ Body: CreateGpsTrackRequest; Params: { workItemId: string } }>(
    '/work-items/:workItemId/gps-tracks',
    {
      preHandler: options.guards.requireMutation,
      schema: {
        body: CreateGpsTrackRequestSchema,
        params: WorkItemParams,
        response: { 201: GpsTrackResponseSchema, 200: GpsTrackResponseSchema },
        tags: ['field'],
      },
    },
    async (request, reply) => {
      const result = await options.gps.create(
        request.params.workItemId,
        request.body,
        ownerId(request),
        header(request, 'x-device-id'),
        header(request, 'idempotency-key'),
        request.id,
      )
      return reply.code(result.idempotentReplay ? 200 : 201).send(result)
    },
  )

  app.post<{ Body: PresignAttachmentRequest }>(
    '/attachments/presign',
    {
      preHandler: options.guards.requireMutation,
      schema: {
        body: PresignAttachmentRequestSchema,
        response: { 201: PresignAttachmentResponseSchema },
        tags: ['field'],
      },
    },
    async (request, reply) =>
      reply
        .code(201)
        .send(await options.evidence.presign(request.body, ownerId(request), request.id)),
  )

  app.post<{ Body: CompleteAttachmentRequest }>(
    '/attachments/complete',
    {
      preHandler: options.guards.requireMutation,
      schema: {
        body: CompleteAttachmentRequestSchema,
        response: { 200: AttachmentSchema },
        tags: ['field'],
      },
    },
    (request) => options.evidence.complete(request.body.attachmentId, ownerId(request), request.id),
  )
  app.get<{ Params: { attachmentId: string } }>(
    '/attachments/:attachmentId/thumbnail',
    {
      preHandler: options.guards.requireUser,
      schema: { params: AttachmentParams, tags: ['field'] },
    },
    async (request, reply) =>
      reply
        .header('content-type', 'image/webp')
        .send(await options.evidence.thumbnail(request.params.attachmentId, ownerId(request))),
  )
  app.delete<{ Params: { attachmentId: string } }>(
    '/attachments/:attachmentId',
    {
      preHandler: options.guards.requireMutation,
      schema: { params: AttachmentParams, tags: ['field'] },
    },
    async (request, reply) => {
      await options.evidence.remove(request.params.attachmentId, ownerId(request), request.id)
      return reply.code(204).send()
    },
  )
  app.post<{ Body: RestoreRecordRequest; Params: { attachmentId: string } }>(
    '/attachments/:attachmentId/restore',
    {
      preHandler: options.guards.requireMutation,
      schema: {
        body: RestoreRecordRequestSchema,
        params: AttachmentParams,
        response: { 200: AttachmentSchema },
        tags: ['field'],
      },
    },
    (request) =>
      options.evidence.restore(
        request.params.attachmentId,
        request.body.reason,
        ownerId(request),
        request.id,
      ),
  )
}
