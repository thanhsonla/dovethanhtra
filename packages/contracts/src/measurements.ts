import { Type, type Static } from '@sinclair/typebox'

import { DateTimeSchema, UuidSchema } from './common.js'

export const GeoJsonGeometrySchema = Type.Object(
  {
    type: Type.Union([
      Type.Literal('Point'),
      Type.Literal('MultiPoint'),
      Type.Literal('LineString'),
      Type.Literal('MultiLineString'),
      Type.Literal('Polygon'),
      Type.Literal('MultiPolygon'),
    ]),
    coordinates: Type.Unknown(),
  },
  { additionalProperties: false },
)

export const MeasurementGeometryKindSchema = Type.Union([
  Type.Literal('point'),
  Type.Literal('line'),
  Type.Literal('area'),
])

export const MeasurementMethodSchema = Type.Union([
  Type.Literal('map_draw'),
  Type.Literal('gps_point'),
  Type.Literal('gps_track'),
  Type.Literal('route_provider'),
  Type.Literal('import_geojson'),
  Type.Literal('manual_document'),
])

export const MeasurementStatusSchema = Type.Union([
  Type.Literal('draft'),
  Type.Literal('pending_validation'),
  Type.Literal('needs_attention'),
  Type.Literal('confirmed'),
  Type.Literal('superseded'),
  Type.Literal('deleted'),
])

export const MeasurementWarningSchema = Type.Object(
  {
    code: Type.String(),
    severity: Type.Union([Type.Literal('warning'), Type.Literal('error')]),
    message: Type.String(),
    details: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  },
  { additionalProperties: false },
)

export const MeasurementSchema = Type.Object(
  {
    id: UuidSchema,
    caseId: UuidSchema,
    workItemId: UuidSchema,
    code: Type.String(),
    name: Type.String(),
    version: Type.Integer({ minimum: 1 }),
    supersedesId: Type.Union([UuidSchema, Type.Null()]),
    method: MeasurementMethodSchema,
    geometryKind: MeasurementGeometryKindSchema,
    rawGeometry: GeoJsonGeometrySchema,
    normalizedGeometry: Type.Union([GeoJsonGeometrySchema, Type.Null()]),
    baseValue: Type.Union([Type.Number({ minimum: 0 }), Type.Null()]),
    calculatedQuantity: Type.Union([Type.Number({ minimum: 0 }), Type.Null()]),
    unit: Type.String(),
    calculationRuleCode: Type.String(),
    calculationVersion: Type.Integer({ minimum: 1 }),
    calculationInputs: Type.Record(Type.String(), Type.Number()),
    calculationOutput: Type.Record(Type.String(), Type.Unknown()),
    validationStatus: Type.Union([
      Type.Literal('valid'),
      Type.Literal('invalid'),
      Type.Literal('needs_attention'),
    ]),
    warnings: Type.Array(MeasurementWarningSchema),
    status: MeasurementStatusSchema,
    note: Type.Union([Type.String(), Type.Null()]),
    confirmedAt: Type.Union([DateTimeSchema, Type.Null()]),
    createdAt: DateTimeSchema,
    updatedAt: DateTimeSchema,
  },
  { additionalProperties: false, $id: 'Measurement' },
)

export const CreateMeasurementRequestSchema = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 300 }),
    geometryKind: MeasurementGeometryKindSchema,
    geometry: GeoJsonGeometrySchema,
    method: Type.Optional(Type.Union([Type.Literal('map_draw'), Type.Literal('import_geojson')])),
    calculationInputs: Type.Optional(Type.Record(Type.String(), Type.Number({ minimum: 0 }))),
    note: Type.Optional(Type.Union([Type.String({ maxLength: 5000 }), Type.Null()])),
  },
  { additionalProperties: false, $id: 'CreateMeasurementRequest' },
)

export const SupersedeMeasurementRequestSchema = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 300 }),
    geometryKind: MeasurementGeometryKindSchema,
    geometry: GeoJsonGeometrySchema,
    method: Type.Optional(Type.Union([Type.Literal('map_draw'), Type.Literal('import_geojson')])),
    calculationInputs: Type.Optional(Type.Record(Type.String(), Type.Number({ minimum: 0 }))),
    note: Type.Optional(Type.Union([Type.String({ maxLength: 5000 }), Type.Null()])),
    reason: Type.String({ minLength: 3, maxLength: 1000 }),
  },
  { additionalProperties: false, $id: 'SupersedeMeasurementRequest' },
)

export const ConfirmMeasurementRequestSchema = Type.Object(
  { reason: Type.Optional(Type.String({ maxLength: 1000 })) },
  { additionalProperties: false, $id: 'ConfirmMeasurementRequest' },
)

export const MeasurementListResponseSchema = Type.Object(
  {
    items: Type.Array(MeasurementSchema),
    confirmedTotal: Type.Number({ minimum: 0 }),
    unit: Type.String(),
  },
  { additionalProperties: false, $id: 'MeasurementListResponse' },
)

export const CaseMapContextSchema = Type.Object(
  {
    caseId: UuidSchema,
    boundary: GeoJsonGeometrySchema,
  },
  { additionalProperties: false, $id: 'CaseMapContext' },
)

export type CaseMapContext = Static<typeof CaseMapContextSchema>
export type ConfirmMeasurementRequest = Static<typeof ConfirmMeasurementRequestSchema>
export type CreateMeasurementRequest = Static<typeof CreateMeasurementRequestSchema>
export type GeoJsonGeometry = Static<typeof GeoJsonGeometrySchema>
export type Measurement = Static<typeof MeasurementSchema>
export type MeasurementGeometryKind = Static<typeof MeasurementGeometryKindSchema>
export type MeasurementListResponse = Static<typeof MeasurementListResponseSchema>
export type MeasurementWarning = Static<typeof MeasurementWarningSchema>
export type SupersedeMeasurementRequest = Static<typeof SupersedeMeasurementRequestSchema>
