import {
  CaseComparisonSchema,
  ComparisonThresholdSchema,
  CreateSourceQuantityRequestSchema,
  SaveComparisonExplanationRequestSchema,
  SourceQuantitySchema,
  type ComparisonThreshold,
  type CreateSourceQuantityRequest,
  type SaveComparisonExplanationRequest,
} from '@dove/contracts'
import { Type } from '@sinclair/typebox'
import type { FastifyPluginAsync, FastifyRequest } from 'fastify'

import { AppError } from '../../platform/app-error.js'
import type { AuthGuards } from '../identity/auth-guards.js'
import type { ComparisonService } from './comparison-service.js'

const IdParams = Type.Object({ id: Type.String({ format: 'uuid' }) })
const ownerId = (request: FastifyRequest) => {
  if (!request.currentUser) throw new AppError(401, 'AUTH_REQUIRED', 'Bạn cần đăng nhập.')
  return request.currentUser.id
}

export const comparisonRoutes: FastifyPluginAsync<{
  guards: AuthGuards
  service: ComparisonService
}> = async (app, options) => {
  app.get<{ Params: { id: string } }>(
    '/cases/:id/comparison',
    {
      preHandler: options.guards.requireUser,
      schema: { params: IdParams, response: { 200: CaseComparisonSchema }, tags: ['comparison'] },
    },
    (request) => options.service.get(request.params.id, ownerId(request)),
  )

  app.post<{ Body: CreateSourceQuantityRequest; Params: { id: string } }>(
    '/work-items/:id/source-quantities',
    {
      preHandler: options.guards.requireMutation,
      schema: {
        body: CreateSourceQuantityRequestSchema,
        params: IdParams,
        response: { 201: SourceQuantitySchema },
        tags: ['comparison'],
      },
    },
    async (request, reply) =>
      reply
        .code(201)
        .send(
          await options.service.createSource(
            request.params.id,
            request.body,
            ownerId(request),
            request.id,
          ),
        ),
  )

  app.patch<{ Body: ComparisonThreshold; Params: { id: string } }>(
    '/work-items/:id/comparison-settings',
    {
      preHandler: options.guards.requireMutation,
      schema: { body: ComparisonThresholdSchema, params: IdParams, tags: ['comparison'] },
    },
    (request) =>
      options.service.setWorkThreshold(
        request.params.id,
        request.body,
        ownerId(request),
        request.id,
      ),
  )

  app.patch<{ Body: ComparisonThreshold; Params: { id: string } }>(
    '/cases/:id/comparison-settings',
    {
      preHandler: options.guards.requireMutation,
      schema: { body: ComparisonThresholdSchema, params: IdParams, tags: ['comparison'] },
    },
    (request) =>
      options.service.setCaseThreshold(
        request.params.id,
        request.body,
        ownerId(request),
        request.id,
      ),
  )

  app.put<{ Body: SaveComparisonExplanationRequest; Params: { id: string } }>(
    '/source-quantities/:id/explanation',
    {
      preHandler: options.guards.requireMutation,
      schema: {
        body: SaveComparisonExplanationRequestSchema,
        params: IdParams,
        tags: ['comparison'],
      },
    },
    (request) =>
      options.service.explain(request.params.id, request.body, ownerId(request), request.id),
  )
}
