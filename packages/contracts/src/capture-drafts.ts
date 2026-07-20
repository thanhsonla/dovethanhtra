import { Type, type Static } from '@sinclair/typebox'

import { CreateWorkComponentRequestSchema, CreateWorkItemRequestSchema } from './cases.js'
import { DateTimeSchema, UuidSchema } from './common.js'
import {
  DrawableMeasurementGeometryKindSchema,
  GeoJsonGeometrySchema,
  MeasurementSchema,
} from './measurements.js'

export const CaptureDraftStatusSchema = Type.Union([
  Type.Literal('unclassified'),
  Type.Literal('classifying'),
  Type.Literal('classified'),
  Type.Literal('conflict'),
  Type.Literal('deleted'),
])

export const CaptureDraftMethodSchema = Type.Union([
  Type.Literal('map_draw'),
  Type.Literal('import_geojson'),
])

export const CaptureDraftSchema = Type.Object(
  {
    id: UuidSchema,
    caseId: UuidSchema,
    localId: Type.String(),
    deviceId: Type.String(),
    geometryKind: DrawableMeasurementGeometryKindSchema,
    method: CaptureDraftMethodSchema,
    rawGeometry: GeoJsonGeometrySchema,
    metadata: Type.Record(Type.String(), Type.Unknown()),
    status: CaptureDraftStatusSchema,
    version: Type.Integer({ minimum: 1 }),
    classifiedMeasurementId: Type.Union([UuidSchema, Type.Null()]),
    classifiedAt: Type.Union([DateTimeSchema, Type.Null()]),
    deletedAt: Type.Union([DateTimeSchema, Type.Null()]),
    createdAt: DateTimeSchema,
    updatedAt: DateTimeSchema,
  },
  { additionalProperties: false, $id: 'CaptureDraft' },
)

export const CreateCaptureDraftRequestSchema = Type.Object(
  {
    localId: Type.String({ minLength: 1, maxLength: 200 }),
    geometryKind: DrawableMeasurementGeometryKindSchema,
    geometry: GeoJsonGeometrySchema,
    method: Type.Optional(CaptureDraftMethodSchema),
    metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  },
  { additionalProperties: false, $id: 'CreateCaptureDraftRequest' },
)

export const UpdateCaptureDraftRequestSchema = Type.Partial(
  Type.Object({
    geometryKind: DrawableMeasurementGeometryKindSchema,
    geometry: GeoJsonGeometrySchema,
    metadata: Type.Record(Type.String(), Type.Unknown()),
  }),
  { additionalProperties: false, $id: 'UpdateCaptureDraftRequest' },
)

export const CaptureDraftMutationResponseSchema = Type.Object(
  {
    draft: CaptureDraftSchema,
    idempotentReplay: Type.Boolean(),
  },
  { additionalProperties: false, $id: 'CaptureDraftMutationResponse' },
)

export const ClassifyCaptureDraftRequestSchema = Type.Object(
  {
    workItemId: Type.Optional(UuidSchema),
    createWorkItem: Type.Optional(CreateWorkItemRequestSchema),
    workComponentId: Type.Optional(UuidSchema),
    createWorkComponent: Type.Optional(CreateWorkComponentRequestSchema),
    measurementName: Type.String({ minLength: 1, maxLength: 300 }),
    calculationInputs: Type.Optional(Type.Record(Type.String(), Type.Number({ minimum: 0 }))),
    note: Type.Optional(Type.Union([Type.String({ maxLength: 5000 }), Type.Null()])),
  },
  { additionalProperties: false, $id: 'ClassifyCaptureDraftRequest' },
)

export const ClassifyCaptureDraftResponseSchema = Type.Object(
  {
    draft: CaptureDraftSchema,
    measurement: MeasurementSchema,
    idempotentReplay: Type.Boolean(),
  },
  { additionalProperties: false, $id: 'ClassifyCaptureDraftResponse' },
)

export type CaptureDraft = Static<typeof CaptureDraftSchema>
export type CaptureDraftStatus = Static<typeof CaptureDraftStatusSchema>
export type ClassifyCaptureDraftRequest = Static<typeof ClassifyCaptureDraftRequestSchema>
export type ClassifyCaptureDraftResponse = Static<typeof ClassifyCaptureDraftResponseSchema>
export type CreateCaptureDraftRequest = Static<typeof CreateCaptureDraftRequestSchema>
export type CaptureDraftMutationResponse = Static<typeof CaptureDraftMutationResponseSchema>
export type UpdateCaptureDraftRequest = Static<typeof UpdateCaptureDraftRequestSchema>
