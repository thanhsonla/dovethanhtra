import { Type, type Static } from '@sinclair/typebox'

import { DateTimeSchema, UuidSchema } from './common.js'

export const ExportJobSchema = Type.Object(
  {
    id: UuidSchema,
    caseId: UuidSchema,
    format: Type.Union([Type.Literal('xlsx'), Type.Literal('geojson')]),
    status: Type.Union([
      Type.Literal('pending'),
      Type.Literal('processing'),
      Type.Literal('completed'),
      Type.Literal('failed'),
    ]),
    fileName: Type.String(),
    fileHash: Type.Union([Type.String({ minLength: 64, maxLength: 64 }), Type.Null()]),
    sizeBytes: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]),
    errorCode: Type.Union([Type.String(), Type.Null()]),
    errorMessage: Type.Union([Type.String(), Type.Null()]),
    createdAt: DateTimeSchema,
    completedAt: Type.Union([DateTimeSchema, Type.Null()]),
  },
  { additionalProperties: false, $id: 'ExportJob' },
)

export type ExportJob = Static<typeof ExportJobSchema>
