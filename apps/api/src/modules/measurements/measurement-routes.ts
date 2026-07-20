import { createHash } from 'node:crypto'

import {
  ConfirmMeasurementRequestSchema,
  CreateMeasurementRequestSchema,
  MeasurementListResponseSchema,
  MeasurementSchema,
  RestoreRecordRequestSchema,
  SupersedeMeasurementRequestSchema,
  type ConfirmMeasurementRequest,
  type CreateMeasurementRequest,
  type SupersedeMeasurementRequest,
  type RestoreRecordRequest,
  GeoJsonImportRequestSchema,
  GeoJsonImportPreviewSchema,
  GeoJsonImportCommitResponseSchema,
  type GeoJsonImportRequest,
  AuditEventSchema,
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
  app.post<{ Body: GeoJsonImportRequest; Params: { workItemId: string } }>(
    '/work-items/:workItemId/imports/geojson/preview',
    {
      preHandler: options.guards.requireMutation,
      schema: {
        body: GeoJsonImportRequestSchema,
        params: WorkItemParams,
        response: { 200: GeoJsonImportPreviewSchema },
        tags: ['imports'],
      },
    },
    (request) =>
      options.service.previewImport(request.params.workItemId, request.body, ownerId(request)),
  )
  app.post<{ Body: GeoJsonImportRequest; Params: { workItemId: string } }>(
    '/work-items/:workItemId/imports/geojson/commit',
    {
      preHandler: options.guards.requireMutation,
      schema: {
        body: GeoJsonImportRequestSchema,
        params: WorkItemParams,
        response: { 201: GeoJsonImportCommitResponseSchema },
        tags: ['imports'],
      },
    },
    async (request, reply) =>
      reply
        .code(201)
        .send(
          await options.service.commitImport(
            request.params.workItemId,
            request.body,
            ownerId(request),
            request.id,
          ),
        ),
  )
  app.get<{
    Params: { workItemId: string }
    Querystring: { bbox?: string; cursor?: string; limit?: number }
  }>(
    '/work-items/:workItemId/measurements',
    {
      preHandler: options.guards.requireUser,
      schema: {
        params: WorkItemParams,
        querystring: Type.Object({
          bbox: Type.Optional(Type.String({ maxLength: 100 })),
          cursor: Type.Optional(Type.String({ maxLength: 500 })),
          limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 500 })),
        }),
        response: { 200: MeasurementListResponseSchema },
        tags: ['measurements'],
      },
    },
    (request) => {
      let bbox: [number, number, number, number] | undefined
      if (request.query.bbox) {
        const values = request.query.bbox.split(',').map(Number)
        if (
          values.length !== 4 ||
          values.some((value) => !Number.isFinite(value)) ||
          values[0]! >= values[2]! ||
          values[1]! >= values[3]! ||
          values[0]! < -180 ||
          values[2]! > 180 ||
          values[1]! < -90 ||
          values[3]! > 90
        ) {
          throw new AppError(
            400,
            'BBOX_INVALID',
            'Bbox phải là minLon,minLat,maxLon,maxLat hợp lệ.',
          )
        }
        bbox = values as [number, number, number, number]
      }
      return options.service.list(request.params.workItemId, ownerId(request), {
        limit: request.query.limit ?? 200,
        ...(request.query.cursor ? { cursor: request.query.cursor } : {}),
        ...(bbox ? { bbox } : {}),
      })
    },
  )

  app.get<{ Params: { workItemId: string } }>(
    '/work-items/:workItemId/measurements/deleted',
    {
      preHandler: options.guards.requireUser,
      schema: {
        params: WorkItemParams,
        response: { 200: Type.Array(MeasurementSchema) },
        tags: ['measurements'],
      },
    },
    (request) => options.service.listDeleted(request.params.workItemId, ownerId(request)),
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

  app.get<{ Params: { measurementId: string } }>(
    '/measurements/:measurementId/history',
    {
      preHandler: options.guards.requireUser,
      schema: {
        params: MeasurementParams,
        response: { 200: Type.Array(AuditEventSchema) },
        tags: ['measurements'],
      },
    },
    async (request) => {
      const measurement = await options.service.get(request.params.measurementId, ownerId(request))
      return options.service.history(measurement.id, ownerId(request))
    },
  )

  app.get<{ Params: { measurementId: string } }>(
    '/measurements/:measurementId/download.geojson',
    {
      preHandler: options.guards.requireUser,
      schema: { params: MeasurementParams, tags: ['measurements'] },
    },
    async (request, reply) => {
      const measurement = await options.service.get(request.params.measurementId, ownerId(request))
      const payload = JSON.stringify({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            id: measurement.id,
            properties: {
              code: measurement.code,
              name: measurement.name,
              version: measurement.version,
              status: measurement.status,
              unit: measurement.unit,
              calculatedQuantity: measurement.calculatedQuantity,
            },
            geometry: measurement.normalizedGeometry ?? measurement.rawGeometry,
          },
        ],
      })
      const hash = createHash('sha256').update(payload).digest('hex')
      return reply
        .header('content-type', 'application/geo+json')
        .header('content-disposition', `attachment; filename="${measurement.code}.geojson"`)
        .header('x-file-sha256', hash)
        .send(payload)
    },
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

  app.post<{ Body: RestoreRecordRequest; Params: { measurementId: string } }>(
    '/measurements/:measurementId/restore',
    {
      preHandler: options.guards.requireMutation,
      schema: {
        body: RestoreRecordRequestSchema,
        params: MeasurementParams,
        response: { 200: MeasurementSchema },
        tags: ['measurements'],
      },
    },
    (request) =>
      options.service.restore(
        request.params.measurementId,
        request.body.reason,
        ownerId(request),
        request.id,
      ),
  )
}
