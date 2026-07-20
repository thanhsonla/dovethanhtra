import { Type, type Static } from '@sinclair/typebox'

import { DateTimeSchema, UuidSchema } from './common.js'

export const AuditEventSchema = Type.Object(
  {
    id: UuidSchema,
    entityType: Type.String(),
    entityId: UuidSchema,
    action: Type.String(),
    actorId: UuidSchema,
    actorName: Type.String(),
    occurredAt: DateTimeSchema,
    reason: Type.Union([Type.String(), Type.Null()]),
    traceId: Type.String(),
    beforeData: Type.Optional(
      Type.Union([Type.Record(Type.String(), Type.Unknown()), Type.Null()]),
    ),
    afterData: Type.Optional(Type.Union([Type.Record(Type.String(), Type.Unknown()), Type.Null()])),
  },
  { additionalProperties: false, $id: 'AuditEvent' },
)

export type AuditEvent = Static<typeof AuditEventSchema>
