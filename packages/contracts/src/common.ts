import { Type, type Static } from '@sinclair/typebox'

export const UuidSchema = Type.String({ format: 'uuid' })
export const DateSchema = Type.String({ format: 'date' })
export const DateTimeSchema = Type.String({ format: 'date-time' })

export const ApiErrorSchema = Type.Object(
  {
    code: Type.String(),
    message: Type.String(),
    details: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
    traceId: Type.String(),
  },
  { additionalProperties: false, $id: 'ApiError' },
)

export type ApiError = Static<typeof ApiErrorSchema>
