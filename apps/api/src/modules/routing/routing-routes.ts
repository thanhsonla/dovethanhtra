import {
  CreateTreatmentFacilityRequestSchema,
  RecalculateTransportRouteRequestSchema,
  RouteCalculationSchema,
  RouteRequestSchema,
  SaveTransportRouteRequestSchema,
  TreatmentFacilitySchema,
  TransportRouteSchema,
  WeightedDistanceRequestSchema,
  WeightedDistanceResponseSchema,
  type CreateTreatmentFacilityRequest,
  type RecalculateTransportRouteRequest,
  type RouteRequest,
  type SaveTransportRouteRequest,
  type WeightedDistanceRequest,
} from '@dove/contracts'
import { Type } from '@sinclair/typebox'
import type { FastifyPluginAsync, FastifyRequest } from 'fastify'

import { AppError } from '../../platform/app-error.js'
import type { AuthGuards } from '../identity/auth-guards.js'
import type { RoutingService } from './routing-service.js'

const WorkItemParams = Type.Object({ workItemId: Type.String({ format: 'uuid' }) })
const RouteParams = Type.Object({ routeId: Type.String({ format: 'uuid' }) })
const ownerId = (request: FastifyRequest) => {
  if (!request.currentUser) throw new AppError(401, 'AUTH_REQUIRED', 'Bạn cần đăng nhập.')
  return request.currentUser.id
}

export const routingRoutes: FastifyPluginAsync<{
  guards: AuthGuards
  service: RoutingService
}> = async (app, options) => {
  app.get(
    '/treatment-facilities',
    {
      preHandler: options.guards.requireUser,
      schema: { response: { 200: Type.Array(TreatmentFacilitySchema) }, tags: ['routing'] },
    },
    (request) => options.service.listFacilities(ownerId(request)),
  )

  app.post<{ Body: CreateTreatmentFacilityRequest }>(
    '/treatment-facilities',
    {
      preHandler: options.guards.requireMutation,
      schema: {
        body: CreateTreatmentFacilityRequestSchema,
        response: { 201: TreatmentFacilitySchema },
        tags: ['routing'],
      },
    },
    async (request, reply) =>
      reply
        .code(201)
        .send(await options.service.createFacility(request.body, ownerId(request), request.id)),
  )

  app.post<{ Body: RouteRequest }>(
    '/routes/calculate',
    {
      preHandler: options.guards.requireMutation,
      schema: {
        body: RouteRequestSchema,
        response: { 200: RouteCalculationSchema },
        tags: ['routing'],
      },
    },
    (request) => options.service.calculate(request.body, ownerId(request)),
  )

  app.post<{ Body: SaveTransportRouteRequest; Params: { workItemId: string } }>(
    '/work-items/:workItemId/routes',
    {
      preHandler: options.guards.requireMutation,
      schema: {
        body: SaveTransportRouteRequestSchema,
        params: WorkItemParams,
        response: { 201: TransportRouteSchema },
        tags: ['routing'],
      },
    },
    async (request, reply) =>
      reply
        .code(201)
        .send(
          await options.service.save(
            request.params.workItemId,
            request.body,
            ownerId(request),
            request.id,
          ),
        ),
  )

  app.post<{ Body: RecalculateTransportRouteRequest; Params: { routeId: string } }>(
    '/routes/:routeId/recalculate',
    {
      preHandler: options.guards.requireMutation,
      schema: {
        body: RecalculateTransportRouteRequestSchema,
        params: RouteParams,
        response: { 201: TransportRouteSchema },
        tags: ['routing'],
      },
    },
    async (request, reply) =>
      reply
        .code(201)
        .send(
          await options.service.recalculate(
            request.params.routeId,
            request.body,
            ownerId(request),
            request.id,
          ),
        ),
  )

  app.post<{ Body: WeightedDistanceRequest }>(
    '/routes/weighted-distance',
    {
      preHandler: options.guards.requireMutation,
      schema: {
        body: WeightedDistanceRequestSchema,
        response: { 200: WeightedDistanceResponseSchema },
        tags: ['routing'],
      },
    },
    (request) => options.service.weighted(request.body),
  )
}
