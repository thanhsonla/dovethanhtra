import { Type, type Static } from '@sinclair/typebox'

import { DateSchema, DateTimeSchema, UuidSchema } from './common.js'

export const CaseStatusSchema = Type.Union([
  Type.Literal('draft'),
  Type.Literal('in_progress'),
  Type.Literal('review'),
  Type.Literal('locked'),
  Type.Literal('archived'),
])

export const InspectionCaseSchema = Type.Object(
  {
    id: UuidSchema,
    caseCode: Type.String(),
    name: Type.String(),
    adminAreaId: UuidSchema,
    adminAreaName: Type.String(),
    periodStart: DateSchema,
    periodEnd: DateSchema,
    inspectedEntity: Type.Union([Type.String(), Type.Null()]),
    description: Type.Union([Type.String(), Type.Null()]),
    status: CaseStatusSchema,
    workItemCount: Type.Integer({ minimum: 0 }),
    version: Type.Integer({ minimum: 1 }),
    createdAt: DateTimeSchema,
    updatedAt: DateTimeSchema,
  },
  { additionalProperties: false, $id: 'InspectionCase' },
)

export const CreateCaseRequestSchema = Type.Object(
  {
    caseCode: Type.String({ minLength: 1, maxLength: 100, pattern: '^[A-Za-z0-9._/-]+$' }),
    name: Type.String({ minLength: 1, maxLength: 300 }),
    adminAreaId: UuidSchema,
    periodStart: DateSchema,
    periodEnd: DateSchema,
    inspectedEntity: Type.Optional(Type.Union([Type.String({ maxLength: 500 }), Type.Null()])),
    description: Type.Optional(Type.Union([Type.String({ maxLength: 5000 }), Type.Null()])),
  },
  { additionalProperties: false, $id: 'CreateCaseRequest' },
)

export const UpdateCaseRequestSchema = Type.Partial(
  Type.Object({
    name: Type.String({ minLength: 1, maxLength: 300 }),
    periodStart: DateSchema,
    periodEnd: DateSchema,
    inspectedEntity: Type.Union([Type.String({ maxLength: 500 }), Type.Null()]),
    description: Type.Union([Type.String({ maxLength: 5000 }), Type.Null()]),
    status: Type.Union([
      Type.Literal('draft'),
      Type.Literal('in_progress'),
      Type.Literal('review'),
      Type.Literal('archived'),
    ]),
  }),
  { additionalProperties: false, $id: 'UpdateCaseRequest' },
)

export const CaseListResponseSchema = Type.Object(
  {
    items: Type.Array(InspectionCaseSchema),
    nextCursor: Type.Union([Type.String(), Type.Null()]),
  },
  { additionalProperties: false, $id: 'CaseListResponse' },
)

export const WorkItemStatusSchema = Type.Union([
  Type.Literal('draft'),
  Type.Literal('active'),
  Type.Literal('completed'),
  Type.Literal('archived'),
])

export const WorkItemSchema = Type.Object(
  {
    id: UuidSchema,
    caseId: UuidSchema,
    workTypeId: UuidSchema,
    workTypeCode: Type.String(),
    name: Type.String(),
    periodStart: Type.Union([DateSchema, Type.Null()]),
    periodEnd: Type.Union([DateSchema, Type.Null()]),
    unit: Type.String(),
    formulaSnapshot: Type.Record(Type.String(), Type.Unknown()),
    warningThreshold: Type.Record(Type.String(), Type.Unknown()),
    status: WorkItemStatusSchema,
  },
  { additionalProperties: false, $id: 'WorkItem' },
)

export const CreateWorkItemRequestSchema = Type.Object(
  {
    workTypeId: UuidSchema,
    name: Type.String({ minLength: 1, maxLength: 300 }),
    periodStart: Type.Optional(Type.Union([DateSchema, Type.Null()])),
    periodEnd: Type.Optional(Type.Union([DateSchema, Type.Null()])),
    warningThreshold: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  },
  { additionalProperties: false, $id: 'CreateWorkItemRequest' },
)

export type CaseStatus = Static<typeof CaseStatusSchema>
export type CaseListResponse = Static<typeof CaseListResponseSchema>
export type CreateCaseRequest = Static<typeof CreateCaseRequestSchema>
export type CreateWorkItemRequest = Static<typeof CreateWorkItemRequestSchema>
export type InspectionCase = Static<typeof InspectionCaseSchema>
export type UpdateCaseRequest = Static<typeof UpdateCaseRequestSchema>
export type WorkItem = Static<typeof WorkItemSchema>
