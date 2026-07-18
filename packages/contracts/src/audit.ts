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
  },
  { additionalProperties: false, $id: 'AuditEvent' },
)

export type AuditEvent = Static<typeof AuditEventSchema>
