import {
  BasemapCapabilitiesSchema,
  BasemapViewportAttributionSchema,
  type BasemapCapabilities,
  type BasemapViewportAttribution,
} from '@dove/contracts'
import { Type, type Static } from '@sinclair/typebox'
import type { FastifyPluginAsync } from 'fastify'

import { AppError } from '../../platform/app-error.js'
import type { AuthGuards } from '../identity/auth-guards.js'
import type { GoogleMapTiles } from './google-map-tiles-provider.js'

const TileParamsSchema = Type.Object({
  x: Type.Integer({ minimum: 0 }),
  y: Type.Integer({ minimum: 0 }),
  z: Type.Integer({ maximum: 22, minimum: 0 }),
})

const ViewportQuerySchema = Type.Object({
  east: Type.Number({ maximum: 180, minimum: -180 }),
  north: Type.Number({ exclusiveMaximum: 90, exclusiveMinimum: -90 }),
  south: Type.Number({ exclusiveMaximum: 90, exclusiveMinimum: -90 }),
  west: Type.Number({ maximum: 180, minimum: -180 }),
  zoom: Type.Integer({ maximum: 22, minimum: 0 }),
})

export interface BasemapRouteOptions {
  googleMapTiles: GoogleMapTiles | null
  guards: AuthGuards
}

function provider(options: BasemapRouteOptions): GoogleMapTiles {
  if (!options.googleMapTiles) {
    throw new AppError(404, 'BASEMAP_UNAVAILABLE', 'Nền bản đồ Google chưa được cấu hình.')
  }
  return options.googleMapTiles
}

export const basemapRoutes: FastifyPluginAsync<BasemapRouteOptions> = async (app, options) => {
  app.get<{ Reply: BasemapCapabilities }>(
    '/',
    {
      preHandler: options.guards.requireUser,
      schema: { response: { 200: BasemapCapabilitiesSchema }, tags: ['basemaps'] },
    },
    async () => ({ googleMapTiles: Boolean(options.googleMapTiles) }),
  )

  app.get<{ Params: Static<typeof TileParamsSchema> }>(
    '/google/tiles/:z/:x/:y',
    {
      logLevel: 'silent',
      preHandler: options.guards.requireUser,
      schema: { params: TileParamsSchema, tags: ['basemaps'] },
    },
    async (request, reply) => {
      const { x, y, z } = request.params
      const dimension = 2 ** z
      if (x >= dimension || y >= dimension) {
        throw new AppError(400, 'INVALID_TILE_COORDINATES', 'Tọa độ tile không hợp lệ.')
      }
      const tile = await provider(options).getTile(z, x, y)
      return reply
        .headers({ 'cache-control': 'private, no-store', pragma: 'no-cache' })
        .type(tile.contentType)
        .send(tile.bytes)
    },
  )

  app.get<{
    Querystring: Static<typeof ViewportQuerySchema>
    Reply: BasemapViewportAttribution
  }>(
    '/google/viewport',
    {
      logLevel: 'silent',
      preHandler: options.guards.requireUser,
      schema: {
        querystring: ViewportQuerySchema,
        response: { 200: BasemapViewportAttributionSchema },
        tags: ['basemaps'],
      },
    },
    async (request) => provider(options).getViewport(request.query),
  )
}
