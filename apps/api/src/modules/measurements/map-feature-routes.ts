import {
  MapFeatureListResponseSchema,
  MeasurementGeometryKindSchema,
  MeasurementStatusSchema,
  type MeasurementGeometryKind,
  type MeasurementStatus,
} from '@dove/contracts'
import { Type } from '@sinclair/typebox'
import type { FastifyPluginAsync, FastifyRequest } from 'fastify'

import { AppError } from '../../platform/app-error.js'
import type { AuthGuards } from '../identity/auth-guards.js'
import type { MapFeatureService } from './map-feature-service.js'

interface Options {
  guards: AuthGuards
  service: MapFeatureService
}
const Params = Type.Object({ caseId: Type.String({ format: 'uuid' }) })

function ownerId(request: FastifyRequest) {
  if (!request.currentUser) throw new AppError(401, 'AUTH_REQUIRED', 'Bạn cần đăng nhập.')
  return request.currentUser.id
}

function parseBbox(value?: string): [number, number, number, number] | undefined {
  if (!value) return undefined
  const numbers = value.split(',').map(Number)
  if (
    numbers.length !== 4 ||
    numbers.some((number) => !Number.isFinite(number)) ||
    numbers[0]! < -180 ||
    numbers[2]! > 180 ||
    numbers[1]! < -90 ||
    numbers[3]! > 90 ||
    numbers[0]! >= numbers[2]! ||
    numbers[1]! >= numbers[3]!
  ) {
    throw new AppError(400, 'BBOX_INVALID', 'Bbox phải là minLon,minLat,maxLon,maxLat hợp lệ.')
  }
  return numbers as [number, number, number, number]
}

export const mapFeatureRoutes: FastifyPluginAsync<Options> = async (app, options) => {
  app.get<{
    Params: { caseId: string }
    Querystring: {
      bbox?: string
      componentId?: string
      cursor?: string
      geometryKind?: MeasurementGeometryKind
      limit?: number
      managementZoneId?: string
      search?: string
      serviceGroupId?: string
      status?: MeasurementStatus
      workItemId?: string
    }
  }>(
    '/:caseId/map-features',
    {
      preHandler: options.guards.requireUser,
      schema: {
        params: Params,
        querystring: Type.Object({
          bbox: Type.Optional(Type.String({ maxLength: 100 })),
          componentId: Type.Optional(Type.String({ format: 'uuid' })),
          cursor: Type.Optional(Type.String({ maxLength: 500 })),
          geometryKind: Type.Optional(MeasurementGeometryKindSchema),
          limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 500 })),
          managementZoneId: Type.Optional(Type.String({ format: 'uuid' })),
          search: Type.Optional(Type.String({ maxLength: 120 })),
          serviceGroupId: Type.Optional(Type.String({ format: 'uuid' })),
          status: Type.Optional(MeasurementStatusSchema),
          workItemId: Type.Optional(Type.String({ format: 'uuid' })),
        }),
        response: { 200: MapFeatureListResponseSchema },
        tags: ['measurements'],
      },
    },
    (request) => {
      const { bbox: rawBbox, limit, ...filters } = request.query
      const bbox = parseBbox(rawBbox)
      return options.service.list(request.params.caseId, ownerId(request), {
        ...filters,
        limit: limit ?? 200,
        ...(bbox ? { bbox } : {}),
      })
    },
  )
}
