import {
  ConfirmMeasurementRequestSchema,
  CreateMeasurementRequestSchema,
  MeasurementListResponseSchema,
  MeasurementSchema,
  SupersedeMeasurementRequestSchema,
  type ConfirmMeasurementRequest,
  type CreateMeasurementRequest,
  type SupersedeMeasurementRequest,
} from '@dove/contracts'
import { Type } from '@sinclair/typebox'
import type { FastifyPluginAsync, FastifyRequest } from 'fastify'

import { AppError } from '../../platform/app-error.js'
import type { AuthGuards } from '../identity/auth-guards.js'
import type { MeasurementService } from './measurement-service.js'

interface MeasurementRouteOptions {
  guards: AuthGuards
  service: MeasurementService
}

const WorkItemParams = Type.Object({ workItemId: Type.String({ format: 'uuid' }) })
const MeasurementParams = Type.Object({ measurementId: Type.String({ format: 'uuid' }) })

function ownerId(request: FastifyRequest): string {
  if (!request.currentUser) throw new AppError(401, 'AUTH_REQUIRED', 'Bạn cần đăng nhập.')
  return request.currentUser.id
}

export const measurementRoutes: FastifyPluginAsync<MeasurementRouteOptions> = async (
  app,
  options,
) => {
  app.get<{ Params: { workItemId: string } }>(
    '/work-items/:workItemId/measurements',
    {
      preHandler: options.guards.requireUser,
      schema: {
        params: WorkItemParams,
        response: { 200: MeasurementListResponseSchema },
        tags: ['measurements'],
      },
    },
    (request) => options.service.list(request.params.workItemId, ownerId(request)),
  )

  app.post<{ Body: CreateMeasurementRequest; Params: { workItemId: string } }>(
    '/work-items/:workItemId/measurements',
    {
      preHandler: options.guards.requireMutation,
      schema: {
        body: CreateMeasurementRequestSchema,
        params: WorkItemParams,
        response: { 201: MeasurementSchema },
        tags: ['measurements'],
      },
    },
    async (request, reply) => {
      const created = await options.service.create(
        request.params.workItemId,
        request.body,
        ownerId(request),
        request.id,
      )
      return reply.code(201).send(created)
    },
  )

  app.get<{ Params: { measurementId: string } }>(
    '/measurements/:measurementId',
    {
      preHandler: options.guards.requireUser,
      schema: {
        params: MeasurementParams,
        response: { 200: MeasurementSchema },
        tags: ['measurements'],
      },
    },
    (request) => options.service.get(request.params.measurementId, ownerId(request)),
  )

  app.post<{ Params: { measurementId: string } }>(
    '/measurements/:measurementId/validate',
    {
      preHandler: options.guards.requireMutation,
      schema: {
        params: MeasurementParams,
        response: { 200: MeasurementSchema },
        tags: ['measurements'],
      },
    },
    (request) =>
      options.service.validate(request.params.measurementId, ownerId(request), request.id),
  )

  app.post<{ Body: ConfirmMeasurementRequest; Params: { measurementId: string } }>(
    '/measurements/:measurementId/confirm',
    {
      preHandler: options.guards.requireMutation,
      schema: {
        body: ConfirmMeasurementRequestSchema,
        params: MeasurementParams,
        response: { 200: MeasurementSchema },
        tags: ['measurements'],
      },
    },
    (request) =>
      options.service.confirm(
        request.params.measurementId,
        request.body,
        ownerId(request),
        request.id,
      ),
  )

  app.post<{ Body: SupersedeMeasurementRequest; Params: { measurementId: string } }>(
    '/measurements/:measurementId/supersede',
    {
      preHandler: options.guards.requireMutation,
      schema: {
        body: SupersedeMeasurementRequestSchema,
        params: MeasurementParams,
        response: { 201: MeasurementSchema },
        tags: ['measurements'],
      },
    },
    async (request, reply) => {
      const created = await options.service.supersede(
        request.params.measurementId,
        request.body,
        ownerId(request),
        request.id,
      )
      return reply.code(201).send(created)
    },
  )

  app.delete<{ Params: { measurementId: string } }>(
    '/measurements/:measurementId',
    {
      preHandler: options.guards.requireMutation,
      schema: { params: MeasurementParams, tags: ['measurements'] },
    },
    async (request, reply) => {
      await options.service.remove(request.params.measurementId, ownerId(request), request.id)
      return reply.code(204).send()
    },
  )
}
