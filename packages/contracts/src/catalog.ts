import { Type, type Static } from '@sinclair/typebox'

import { DateTimeSchema, UuidSchema } from './common.js'

export const MeasurementKindSchema = Type.Union([
  Type.Literal('count'),
  Type.Literal('point'),
  Type.Literal('line'),
  Type.Literal('area'),
  Type.Literal('route'),
  Type.Literal('composite'),
])

export const ServiceGroupSchema = Type.Object(
  {
    id: UuidSchema,
    code: Type.String(),
    name: Type.String(),
    displayOrder: Type.Integer(),
    color: Type.Union([Type.String(), Type.Null()]),
    active: Type.Boolean(),
    createdAt: DateTimeSchema,
    updatedAt: DateTimeSchema,
  },
  { additionalProperties: false, $id: 'ServiceGroup' },
)

export const CreateServiceGroupRequestSchema = Type.Object(
  {
    code: Type.String({ minLength: 2, maxLength: 100, pattern: '^[A-Z0-9_]+$' }),
    name: Type.String({ minLength: 1, maxLength: 300 }),
    displayOrder: Type.Integer({ minimum: 0, maximum: 10_000 }),
    color: Type.Optional(Type.Union([Type.String({ pattern: '^#[0-9A-Fa-f]{6}$' }), Type.Null()])),
  },
  { additionalProperties: false, $id: 'CreateServiceGroupRequest' },
)

export const UpdateServiceGroupRequestSchema = Type.Partial(
  Type.Object({
    name: Type.String({ minLength: 1, maxLength: 300 }),
    displayOrder: Type.Integer({ minimum: 0, maximum: 10_000 }),
    color: Type.Union([Type.String({ pattern: '^#[0-9A-Fa-f]{6}$' }), Type.Null()]),
    active: Type.Boolean(),
  }),
  { additionalProperties: false, $id: 'UpdateServiceGroupRequest' },
)

export const WorkTypeSchema = Type.Object(
  {
    id: UuidSchema,
    serviceGroupId: UuidSchema,
    code: Type.String(),
    name: Type.String(),
    measurementKind: MeasurementKindSchema,
    baseUnit: Type.String(),
    attributeSchema: Type.Record(Type.String(), Type.Unknown()),
    calculationSpec: Type.Record(Type.String(), Type.Unknown()),
    calculationVersion: Type.Integer({ minimum: 1 }),
    active: Type.Boolean(),
    createdAt: DateTimeSchema,
    updatedAt: DateTimeSchema,
  },
  { additionalProperties: false, $id: 'WorkType' },
)

export const CreateWorkTypeRequestSchema = Type.Object(
  {
    serviceGroupId: UuidSchema,
    code: Type.String({ minLength: 2, maxLength: 100, pattern: '^[A-Z0-9_]+$' }),
    name: Type.String({ minLength: 1, maxLength: 300 }),
    measurementKind: MeasurementKindSchema,
    baseUnit: Type.String({ minLength: 1, maxLength: 100 }),
    attributeSchema: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
    calculationSpec: Type.Record(Type.String(), Type.Unknown()),
    calculationVersion: Type.Integer({ minimum: 1 }),
  },
  { additionalProperties: false, $id: 'CreateWorkTypeRequest' },
)

export const UpdateWorkTypeRequestSchema = Type.Partial(
  Type.Object({
    name: Type.String({ minLength: 1, maxLength: 300 }),
    active: Type.Boolean(),
  }),
  { additionalProperties: false, $id: 'UpdateWorkTypeRequest' },
)

export type CreateServiceGroupRequest = Static<typeof CreateServiceGroupRequestSchema>
export type CreateWorkTypeRequest = Static<typeof CreateWorkTypeRequestSchema>
export type MeasurementKind = Static<typeof MeasurementKindSchema>
export type ServiceGroup = Static<typeof ServiceGroupSchema>
export type UpdateServiceGroupRequest = Static<typeof UpdateServiceGroupRequestSchema>
export type UpdateWorkTypeRequest = Static<typeof UpdateWorkTypeRequestSchema>
export type WorkType = Static<typeof WorkTypeSchema>
