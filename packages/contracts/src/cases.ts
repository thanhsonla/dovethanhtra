import { Type, type Static } from '@sinclair/typebox'

import { DateSchema, DateTimeSchema, UuidSchema } from './common.js'
import { MeasurementKindSchema } from './catalog.js'

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
    deletedAt: Type.Union([DateTimeSchema, Type.Null()]),
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
    copyStructure: Type.Optional(
      Type.Object(
        {
          sourceCaseId: UuidSchema,
          workItemIds: Type.Optional(
            Type.Array(UuidSchema, { minItems: 1, maxItems: 200, uniqueItems: true }),
          ),
        },
        { additionalProperties: false },
      ),
    ),
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

export const RestoreRecordRequestSchema = Type.Object(
  { reason: Type.String({ minLength: 3, maxLength: 1000 }) },
  { additionalProperties: false, $id: 'RestoreRecordRequest' },
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
    managementZoneId: Type.Union([UuidSchema, Type.Null()]),
    managementZoneName: Type.Union([Type.String(), Type.Null()]),
    serviceGroupId: UuidSchema,
    serviceGroupName: Type.String(),
    measurementKind: MeasurementKindSchema,
    workTypeId: UuidSchema,
    workTypeCode: Type.String(),
    name: Type.String(),
    periodStart: Type.Union([DateSchema, Type.Null()]),
    periodEnd: Type.Union([DateSchema, Type.Null()]),
    unit: Type.String(),
    formulaSnapshot: Type.Record(Type.String(), Type.Unknown()),
    warningThreshold: Type.Record(Type.String(), Type.Unknown()),
    status: WorkItemStatusSchema,
    version: Type.Integer({ minimum: 1 }),
    deletedAt: Type.Union([DateTimeSchema, Type.Null()]),
  },
  { additionalProperties: false, $id: 'WorkItem' },
)

export const CreateWorkItemRequestSchema = Type.Object(
  {
    workTypeId: UuidSchema,
    managementZoneId: Type.Optional(Type.Union([UuidSchema, Type.Null()])),
    name: Type.String({ minLength: 1, maxLength: 300 }),
    periodStart: Type.Optional(Type.Union([DateSchema, Type.Null()])),
    periodEnd: Type.Optional(Type.Union([DateSchema, Type.Null()])),
    warningThreshold: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  },
  { additionalProperties: false, $id: 'CreateWorkItemRequest' },
)

export const UpdateWorkItemRequestSchema = Type.Partial(
  Type.Object({
    name: Type.String({ minLength: 1, maxLength: 300 }),
    managementZoneId: Type.Union([UuidSchema, Type.Null()]),
    periodStart: Type.Union([DateSchema, Type.Null()]),
    periodEnd: Type.Union([DateSchema, Type.Null()]),
    warningThreshold: Type.Record(Type.String(), Type.Unknown()),
    status: WorkItemStatusSchema,
  }),
  { additionalProperties: false, $id: 'UpdateWorkItemRequest' },
)

export const WorkComponentStatusSchema = Type.Union([
  Type.Literal('draft'),
  Type.Literal('active'),
  Type.Literal('completed'),
  Type.Literal('archived'),
])

export const WorkComponentSchema = Type.Object(
  {
    id: UuidSchema,
    workItemId: UuidSchema,
    name: Type.String(),
    displayOrder: Type.Integer(),
    status: WorkComponentStatusSchema,
    version: Type.Integer({ minimum: 1 }),
    deletedAt: Type.Union([DateTimeSchema, Type.Null()]),
    createdAt: DateTimeSchema,
    updatedAt: DateTimeSchema,
  },
  { additionalProperties: false, $id: 'WorkComponent' },
)

export const CreateWorkComponentRequestSchema = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 300 }),
    displayOrder: Type.Optional(Type.Integer({ minimum: 0, maximum: 10_000 })),
  },
  { additionalProperties: false, $id: 'CreateWorkComponentRequest' },
)

export const UpdateWorkComponentRequestSchema = Type.Partial(
  Type.Object({
    name: Type.String({ minLength: 1, maxLength: 300 }),
    displayOrder: Type.Integer({ minimum: 0, maximum: 10_000 }),
    status: WorkComponentStatusSchema,
  }),
  { additionalProperties: false, $id: 'UpdateWorkComponentRequest' },
)

export const CaseTransitionRequestSchema = Type.Object(
  { reason: Type.String({ minLength: 3, maxLength: 1000 }) },
  { additionalProperties: false, $id: 'CaseTransitionRequest' },
)

export const CaseSnapshotSchema = Type.Object(
  {
    id: UuidSchema,
    caseId: UuidSchema,
    snapshotType: Type.Union([Type.Literal('lock'), Type.Literal('export')]),
    snapshotHash: Type.String({ minLength: 64, maxLength: 64 }),
    createdAt: DateTimeSchema,
  },
  { additionalProperties: false, $id: 'CaseSnapshot' },
)
export const CaseTransitionResponseSchema = Type.Object(
  {
    inspectionCase: InspectionCaseSchema,
    snapshot: Type.Union([CaseSnapshotSchema, Type.Null()]),
  },
  { additionalProperties: false, $id: 'CaseTransitionResponse' },
)

export type CaseStatus = Static<typeof CaseStatusSchema>
export type CaseSnapshot = Static<typeof CaseSnapshotSchema>
export type CaseTransitionRequest = Static<typeof CaseTransitionRequestSchema>
export type CaseTransitionResponse = Static<typeof CaseTransitionResponseSchema>
export type CaseListResponse = Static<typeof CaseListResponseSchema>
export type CreateCaseRequest = Static<typeof CreateCaseRequestSchema>
export type CreateWorkItemRequest = Static<typeof CreateWorkItemRequestSchema>
export type CreateWorkComponentRequest = Static<typeof CreateWorkComponentRequestSchema>
export type InspectionCase = Static<typeof InspectionCaseSchema>
export type RestoreRecordRequest = Static<typeof RestoreRecordRequestSchema>
export type UpdateCaseRequest = Static<typeof UpdateCaseRequestSchema>
export type UpdateWorkComponentRequest = Static<typeof UpdateWorkComponentRequestSchema>
export type UpdateWorkItemRequest = Static<typeof UpdateWorkItemRequestSchema>
export type WorkComponent = Static<typeof WorkComponentSchema>
export type WorkItem = Static<typeof WorkItemSchema>
