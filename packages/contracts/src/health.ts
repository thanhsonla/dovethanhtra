import { Type, type Static } from '@sinclair/typebox'

export const LivenessResponseSchema = Type.Object(
  {
    status: Type.Literal('ok'),
  },
  { additionalProperties: false, $id: 'LivenessResponse' },
)

export const ReadinessResponseSchema = Type.Object(
  {
    status: Type.Union([Type.Literal('ready'), Type.Literal('not_ready')]),
    checks: Type.Object(
      {
        database: Type.Boolean(),
        objectStorage: Type.Boolean(),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false, $id: 'ReadinessResponse' },
)

export type LivenessResponse = Static<typeof LivenessResponseSchema>
export type ReadinessResponse = Static<typeof ReadinessResponseSchema>
