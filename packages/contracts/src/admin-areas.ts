import { Type, type Static } from '@sinclair/typebox'

import { DateSchema, UuidSchema } from './common.js'

export const AdminAreaSchema = Type.Object(
  {
    id: UuidSchema,
    code: Type.String(),
    name: Type.String(),
    areaType: Type.String(),
    source: Type.Union([Type.String(), Type.Null()]),
    sourceHash: Type.Union([Type.String({ pattern: '^[0-9a-f]{64}$' }), Type.Null()]),
    sourceVersion: Type.String(),
    validFrom: DateSchema,
    validTo: Type.Union([DateSchema, Type.Null()]),
  },
  { additionalProperties: false, $id: 'AdminArea' },
)

export type AdminArea = Static<typeof AdminAreaSchema>
