import { Type, type Static } from '@sinclair/typebox'

import { MeasurementGeometryKindSchema, MeasurementSchema } from './measurements.js'
import { UuidSchema } from './common.js'

export const GeoJsonImportRequestSchema = Type.Object(
  {
    sourceName: Type.String({ minLength: 1, maxLength: 255 }),
    collection: Type.Unknown(),
    expectedHash: Type.Optional(Type.String({ pattern: '^[a-f0-9]{64}$' })),
    nameProperty: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  },
  { additionalProperties: false, $id: 'GeoJsonImportRequest' },
)

export const ImportPropertySchemaSchema = Type.Object(
  {
    name: Type.String(),
    types: Type.Array(
      Type.Union([
        Type.Literal('string'),
        Type.Literal('number'),
        Type.Literal('boolean'),
        Type.Literal('null'),
      ]),
    ),
  },
  { additionalProperties: false },
)

export const GeoJsonImportPreviewSchema = Type.Object(
  {
    sourceHash: Type.String({ minLength: 64, maxLength: 64 }),
    sizeBytes: Type.Integer({ minimum: 1 }),
    featureCount: Type.Integer({ minimum: 1, maximum: 1000 }),
    geometryKind: MeasurementGeometryKindSchema,
    detectedSchema: Type.Array(ImportPropertySchemaSchema),
    sampleNames: Type.Array(Type.String(), { maxItems: 10 }),
  },
  { additionalProperties: false, $id: 'GeoJsonImportPreview' },
)

export const GeoJsonImportCommitResponseSchema = Type.Object(
  {
    batchId: UuidSchema,
    sourceHash: Type.String({ minLength: 64, maxLength: 64 }),
    measurements: Type.Array(MeasurementSchema),
  },
  { additionalProperties: false, $id: 'GeoJsonImportCommitResponse' },
)

export type GeoJsonImportRequest = Static<typeof GeoJsonImportRequestSchema>
export type GeoJsonImportPreview = Static<typeof GeoJsonImportPreviewSchema>
export type GeoJsonImportCommitResponse = Static<typeof GeoJsonImportCommitResponseSchema>
