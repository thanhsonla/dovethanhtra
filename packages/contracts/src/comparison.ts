import { Type, type Static } from '@sinclair/typebox'

import { DateSchema, DateTimeSchema, UuidSchema } from './common.js'

export const SourceQuantityKindSchema = Type.Union([
  Type.Literal('estimate'),
  Type.Literal('contract'),
  Type.Literal('reported'),
  Type.Literal('accepted'),
  Type.Literal('other'),
])

export const ComparisonThresholdSchema = Type.Object(
  {
    absolute: Type.Optional(Type.Number({ minimum: 0 })),
    percent: Type.Optional(Type.Number({ minimum: 0 })),
  },
  { additionalProperties: false },
)

export const SourceQuantitySchema = Type.Object(
  {
    id: UuidSchema,
    workItemId: UuidSchema,
    sourceKind: SourceQuantityKindSchema,
    documentNo: Type.Union([Type.String(), Type.Null()]),
    documentDate: Type.Union([DateSchema, Type.Null()]),
    quantity: Type.Number({ minimum: 0 }),
    unit: Type.String(),
    periodStart: Type.Union([DateSchema, Type.Null()]),
    periodEnd: Type.Union([DateSchema, Type.Null()]),
    note: Type.Union([Type.String(), Type.Null()]),
    attachmentId: Type.Union([UuidSchema, Type.Null()]),
    createdAt: DateTimeSchema,
  },
  { additionalProperties: false, $id: 'SourceQuantity' },
)

export const CreateSourceQuantityRequestSchema = Type.Object(
  {
    sourceKind: SourceQuantityKindSchema,
    documentNo: Type.Optional(Type.Union([Type.String({ maxLength: 200 }), Type.Null()])),
    documentDate: Type.Optional(Type.Union([DateSchema, Type.Null()])),
    quantity: Type.Number({ minimum: 0 }),
    unit: Type.String({ minLength: 1, maxLength: 50 }),
    periodStart: Type.Optional(Type.Union([DateSchema, Type.Null()])),
    periodEnd: Type.Optional(Type.Union([DateSchema, Type.Null()])),
    note: Type.Optional(Type.Union([Type.String({ maxLength: 5000 }), Type.Null()])),
    attachmentId: Type.Optional(Type.Union([UuidSchema, Type.Null()])),
  },
  { additionalProperties: false, $id: 'CreateSourceQuantityRequest' },
)

export const ComparisonItemSchema = Type.Object(
  {
    workItemId: UuidSchema,
    workItemName: Type.String(),
    groupId: UuidSchema,
    groupName: Type.String(),
    unit: Type.String(),
    sourceQuantityId: Type.Union([UuidSchema, Type.Null()]),
    sourceKind: Type.Union([SourceQuantityKindSchema, Type.Null()]),
    sourceQuantity: Type.Union([Type.Number({ minimum: 0 }), Type.Null()]),
    sourceAttachmentId: Type.Union([UuidSchema, Type.Null()]),
    inspectedQuantity: Type.Number({ minimum: 0 }),
    difference: Type.Union([Type.Number(), Type.Null()]),
    absoluteDifference: Type.Union([Type.Number({ minimum: 0 }), Type.Null()]),
    differencePercent: Type.Union([Type.Number(), Type.Null()]),
    status: Type.Union([
      Type.Literal('within_threshold'),
      Type.Literal('warning'),
      Type.Literal('no_source_baseline'),
    ]),
    threshold: ComparisonThresholdSchema,
    explanation: Type.Union([Type.String(), Type.Null()]),
    explanationAttachmentId: Type.Union([UuidSchema, Type.Null()]),
  },
  { additionalProperties: false },
)

export const ComparisonAggregateSchema = Type.Object(
  {
    groupId: Type.Union([UuidSchema, Type.Null()]),
    groupName: Type.String(),
    sourceKind: SourceQuantityKindSchema,
    unit: Type.String(),
    sourceQuantity: Type.Number({ minimum: 0 }),
    inspectedQuantity: Type.Number({ minimum: 0 }),
    difference: Type.Number(),
    differencePercent: Type.Union([Type.Number(), Type.Null()]),
  },
  { additionalProperties: false },
)

export const CaseComparisonSchema = Type.Object(
  {
    caseId: UuidSchema,
    items: Type.Array(ComparisonItemSchema),
    aggregates: Type.Array(ComparisonAggregateSchema),
  },
  { additionalProperties: false, $id: 'CaseComparison' },
)

export const SaveComparisonExplanationRequestSchema = Type.Object(
  {
    explanation: Type.String({ minLength: 3, maxLength: 5000 }),
    attachmentId: Type.Optional(Type.Union([UuidSchema, Type.Null()])),
  },
  { additionalProperties: false, $id: 'SaveComparisonExplanationRequest' },
)

export type CaseComparison = Static<typeof CaseComparisonSchema>
export type ComparisonAggregate = Static<typeof ComparisonAggregateSchema>
export type ComparisonItem = Static<typeof ComparisonItemSchema>
export type ComparisonThreshold = Static<typeof ComparisonThresholdSchema>
export type CreateSourceQuantityRequest = Static<typeof CreateSourceQuantityRequestSchema>
export type SaveComparisonExplanationRequest = Static<typeof SaveComparisonExplanationRequestSchema>
export type SourceQuantity = Static<typeof SourceQuantitySchema>
export type SourceQuantityKind = Static<typeof SourceQuantityKindSchema>
