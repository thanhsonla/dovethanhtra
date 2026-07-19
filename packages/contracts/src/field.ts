import { Type, type Static } from '@sinclair/typebox'

import { DateTimeSchema, UuidSchema } from './common.js'
import { MeasurementSchema } from './measurements.js'
import { RoutePositionSchema } from './routing.js'

export const GpsPointSchema = Type.Object(
  {
    position: RoutePositionSchema,
    recordedAt: DateTimeSchema,
    accuracyM: Type.Number({ minimum: 0, maximum: 10000 }),
    altitudeM: Type.Optional(Type.Number()),
    speedMps: Type.Optional(Type.Number({ minimum: 0 })),
  },
  { additionalProperties: false },
)
export const CreateGpsTrackRequestSchema = Type.Object(
  {
    localId: Type.String({ minLength: 1, maxLength: 200 }),
    name: Type.String({ minLength: 1, maxLength: 300 }),
    segments: Type.Array(Type.Array(GpsPointSchema, { minItems: 2, maxItems: 10000 }), {
      minItems: 1,
      maxItems: 100,
    }),
    accuracyThresholdM: Type.Number({ minimum: 1, maximum: 1000 }),
    calculationInputs: Type.Optional(Type.Record(Type.String(), Type.Number({ minimum: 0 }))),
    note: Type.Optional(Type.Union([Type.String({ maxLength: 5000 }), Type.Null()])),
  },
  { additionalProperties: false, $id: 'CreateGpsTrackRequest' },
)
export const GpsTrackResponseSchema = Type.Object(
  {
    measurement: MeasurementSchema,
    rawPointCount: Type.Integer({ minimum: 1 }),
    normalizedPointCount: Type.Integer({ minimum: 0 }),
    segmentCount: Type.Integer({ minimum: 1 }),
    idempotentReplay: Type.Boolean(),
  },
  { additionalProperties: false, $id: 'GpsTrackResponse' },
)

export const CreateGpsPointRequestSchema = Type.Object(
  {
    localId: Type.String({ minLength: 1, maxLength: 200 }),
    name: Type.String({ minLength: 1, maxLength: 300 }),
    point: GpsPointSchema,
    accuracyThresholdM: Type.Number({ minimum: 1, maximum: 1000 }),
    calculationInputs: Type.Optional(Type.Record(Type.String(), Type.Number({ minimum: 0 }))),
    note: Type.Optional(Type.Union([Type.String({ maxLength: 5000 }), Type.Null()])),
  },
  { additionalProperties: false, $id: 'CreateGpsPointRequest' },
)
export const GpsPointResponseSchema = Type.Object(
  {
    measurement: MeasurementSchema,
    idempotentReplay: Type.Boolean(),
  },
  { additionalProperties: false, $id: 'GpsPointResponse' },
)

export const AttachmentSchema = Type.Object(
  {
    id: UuidSchema,
    measurementId: Type.Union([UuidSchema, Type.Null()]),
    workItemId: Type.Union([UuidSchema, Type.Null()]),
    originalName: Type.String(),
    mimeType: Type.String(),
    sizeBytes: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]),
    sha256: Type.Union([Type.String({ minLength: 64, maxLength: 64 }), Type.Null()]),
    uploadStatus: Type.Union([
      Type.Literal('pending'),
      Type.Literal('completed'),
      Type.Literal('failed'),
    ]),
    scanStatus: Type.Union([
      Type.Literal('pending'),
      Type.Literal('clean'),
      Type.Literal('infected'),
      Type.Literal('error'),
      Type.Literal('not_scanned_legacy'),
    ]),
    thumbnailAvailable: Type.Boolean(),
    createdAt: DateTimeSchema,
    completedAt: Type.Union([DateTimeSchema, Type.Null()]),
  },
  { additionalProperties: false, $id: 'Attachment' },
)
export const PresignAttachmentRequestSchema = Type.Object(
  {
    measurementId: Type.Optional(UuidSchema),
    workItemId: Type.Optional(UuidSchema),
    originalName: Type.String({ minLength: 1, maxLength: 255 }),
    mimeType: Type.Union([
      Type.Literal('image/jpeg'),
      Type.Literal('image/png'),
      Type.Literal('image/webp'),
    ]),
    sizeBytes: Type.Integer({ minimum: 1, maximum: 15_000_000 }),
    sha256: Type.String({ pattern: '^[a-f0-9]{64}$' }),
  },
  { additionalProperties: false, $id: 'PresignAttachmentRequest' },
)
export const PresignAttachmentResponseSchema = Type.Object(
  {
    attachment: AttachmentSchema,
    uploadUrl: Type.String({ format: 'uri' }),
    expiresInSeconds: Type.Integer({ minimum: 1 }),
  },
  { additionalProperties: false, $id: 'PresignAttachmentResponse' },
)
export const CompleteAttachmentRequestSchema = Type.Object(
  { attachmentId: UuidSchema },
  { additionalProperties: false, $id: 'CompleteAttachmentRequest' },
)

export type Attachment = Static<typeof AttachmentSchema>
export type CompleteAttachmentRequest = Static<typeof CompleteAttachmentRequestSchema>
export type CreateGpsPointRequest = Static<typeof CreateGpsPointRequestSchema>
export type CreateGpsTrackRequest = Static<typeof CreateGpsTrackRequestSchema>
export type GpsPoint = Static<typeof GpsPointSchema>
export type GpsPointResponse = Static<typeof GpsPointResponseSchema>
export type GpsTrackResponse = Static<typeof GpsTrackResponseSchema>
export type PresignAttachmentRequest = Static<typeof PresignAttachmentRequestSchema>
export type PresignAttachmentResponse = Static<typeof PresignAttachmentResponseSchema>
