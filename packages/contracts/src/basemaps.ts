import { Type, type Static } from '@sinclair/typebox'

export const BasemapCapabilitiesSchema = Type.Object({
  googleMapTiles: Type.Boolean(),
})

export type BasemapCapabilities = Static<typeof BasemapCapabilitiesSchema>

export const BasemapViewportAttributionSchema = Type.Object({
  attribution: Type.String({ maxLength: 2_000 }),
  maxZoom: Type.Optional(Type.Integer({ minimum: 0, maximum: 22 })),
})

export type BasemapViewportAttribution = Static<typeof BasemapViewportAttributionSchema>
