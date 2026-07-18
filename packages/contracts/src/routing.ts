import { Type, type Static } from '@sinclair/typebox'

import { DateTimeSchema, UuidSchema } from './common.js'
import { GeoJsonGeometrySchema, MeasurementSchema } from './measurements.js'

export const RoutePositionSchema = Type.Tuple([
  Type.Number({ minimum: -180, maximum: 180 }),
  Type.Number({ minimum: -90, maximum: 90 }),
])
export const RouteProfileSchema = Type.Union([
  Type.Literal('driving'),
  Type.Literal('driving-traffic'),
])
export const RouteRequestSchema = Type.Object(
  {
    origin: RoutePositionSchema,
    destination: RoutePositionSchema,
    waypoints: Type.Array(RoutePositionSchema, { maxItems: 23 }),
    profile: RouteProfileSchema,
    alternatives: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false, $id: 'RouteRequest' },
)
export const RouteLegSchema = Type.Object(
  {
    index: Type.Integer({ minimum: 0 }),
    distanceM: Type.Number({ minimum: 0 }),
    durationS: Type.Number({ minimum: 0 }),
    from: RoutePositionSchema,
    to: RoutePositionSchema,
  },
  { additionalProperties: false },
)
export const RouteCandidateSchema = Type.Object(
  {
    distanceM: Type.Number({ minimum: 0 }),
    durationS: Type.Number({ minimum: 0 }),
    geometry: GeoJsonGeometrySchema,
    legs: Type.Array(RouteLegSchema),
    warnings: Type.Array(Type.String()),
  },
  { additionalProperties: false },
)
export const RouteCalculationSchema = Type.Object(
  {
    calculatedAt: DateTimeSchema,
    candidates: Type.Array(RouteCandidateSchema),
    provider: Type.String(),
    requestFingerprint: Type.String({ minLength: 64, maxLength: 64 }),
  },
  { additionalProperties: false, $id: 'RouteCalculation' },
)
export const FacilityTypeSchema = Type.Union([
  Type.Literal('collection_point'),
  Type.Literal('transfer_station'),
  Type.Literal('treatment_facility'),
  Type.Literal('depot'),
])
export const TreatmentFacilitySchema = Type.Object(
  {
    id: UuidSchema,
    code: Type.String(),
    name: Type.String(),
    facilityType: FacilityTypeSchema,
    location: RoutePositionSchema,
    address: Type.Union([Type.String(), Type.Null()]),
    active: Type.Boolean(),
  },
  { additionalProperties: false, $id: 'TreatmentFacility' },
)
export const CreateTreatmentFacilityRequestSchema = Type.Object(
  {
    code: Type.String({ minLength: 1, maxLength: 100 }),
    name: Type.String({ minLength: 1, maxLength: 300 }),
    facilityType: FacilityTypeSchema,
    location: RoutePositionSchema,
    address: Type.Optional(Type.Union([Type.String({ maxLength: 1000 }), Type.Null()])),
  },
  { additionalProperties: false, $id: 'CreateTreatmentFacilityRequest' },
)
export const SaveTransportRouteRequestSchema = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 300 }),
    request: RouteRequestSchema,
    candidateIndex: Type.Integer({ minimum: 0, maximum: 2 }),
    treatmentFacilityId: Type.Optional(UuidSchema),
    returnFactor: Type.Number({ minimum: 0, maximum: 10 }),
    tripCount: Type.Number({ minimum: 0 }),
    transportedWeightTon: Type.Optional(Type.Number({ minimum: 0 })),
    note: Type.Optional(Type.Union([Type.String({ maxLength: 5000 }), Type.Null()])),
  },
  { additionalProperties: false, $id: 'SaveTransportRouteRequest' },
)
export const RecalculateTransportRouteRequestSchema = Type.Object(
  {
    reason: Type.String({ minLength: 3, maxLength: 1000 }),
    candidateIndex: Type.Optional(Type.Integer({ minimum: 0, maximum: 2 })),
  },
  { additionalProperties: false, $id: 'RecalculateTransportRouteRequest' },
)
export const TransportRouteSchema = Type.Object(
  {
    id: UuidSchema,
    measurement: MeasurementSchema,
    provider: Type.String(),
    profile: RouteProfileSchema,
    origin: RoutePositionSchema,
    destination: RoutePositionSchema,
    waypoints: Type.Array(RoutePositionSchema),
    legs: Type.Array(RouteLegSchema),
    routeGeometry: GeoJsonGeometrySchema,
    distanceOneWayM: Type.Number({ minimum: 0 }),
    durationS: Type.Number({ minimum: 0 }),
    returnFactor: Type.Number({ minimum: 0 }),
    tripCount: Type.Number({ minimum: 0 }),
    transportedWeightTon: Type.Union([Type.Number({ minimum: 0 }), Type.Null()]),
    vehicleKm: Type.Number({ minimum: 0 }),
    tonKm: Type.Union([Type.Number({ minimum: 0 }), Type.Null()]),
    requestFingerprint: Type.String({ minLength: 64, maxLength: 64 }),
    calculatedAt: DateTimeSchema,
    treatmentFacilityId: Type.Union([UuidSchema, Type.Null()]),
  },
  { additionalProperties: false, $id: 'TransportRoute' },
)
export const WeightedDistanceRequestSchema = Type.Object(
  {
    routes: Type.Array(
      Type.Object({
        distanceKm: Type.Number({ minimum: 0 }),
        weightTon: Type.Number({ minimum: 0 }),
      }),
      { minItems: 1 },
    ),
  },
  { additionalProperties: false, $id: 'WeightedDistanceRequest' },
)
export const WeightedDistanceResponseSchema = Type.Object(
  {
    weightedDistanceKm: Type.Union([Type.Number({ minimum: 0 }), Type.Null()]),
    warnings: Type.Array(Type.String()),
  },
  { additionalProperties: false, $id: 'WeightedDistanceResponse' },
)

export type CreateTreatmentFacilityRequest = Static<typeof CreateTreatmentFacilityRequestSchema>
export type RecalculateTransportRouteRequest = Static<typeof RecalculateTransportRouteRequestSchema>
export type RouteCalculation = Static<typeof RouteCalculationSchema>
export type RouteCandidate = Static<typeof RouteCandidateSchema>
export type RouteLeg = Static<typeof RouteLegSchema>
export type RoutePosition = Static<typeof RoutePositionSchema>
export type RouteRequest = Static<typeof RouteRequestSchema>
export type SaveTransportRouteRequest = Static<typeof SaveTransportRouteRequestSchema>
export type TransportRoute = Static<typeof TransportRouteSchema>
export type TreatmentFacility = Static<typeof TreatmentFacilitySchema>
export type WeightedDistanceRequest = Static<typeof WeightedDistanceRequestSchema>
export type WeightedDistanceResponse = Static<typeof WeightedDistanceResponseSchema>
