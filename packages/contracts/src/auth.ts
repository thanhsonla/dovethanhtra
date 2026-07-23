import { Type, type Static } from '@sinclair/typebox'

import { DateTimeSchema, UuidSchema } from './common.js'

export const UserRoleSchema = Type.Union([
  Type.Literal('owner'),
  Type.Literal('editor'),
  Type.Literal('reviewer'),
  Type.Literal('viewer'),
  Type.Literal('catalog_admin'),
])

export const CurrentUserSchema = Type.Object(
  {
    id: UuidSchema,
    email: Type.String({ minLength: 3, maxLength: 320 }),
    displayName: Type.String(),
    role: UserRoleSchema,
  },
  { additionalProperties: false, $id: 'CurrentUser' },
)

export const LoginRequestSchema = Type.Object(
  {
    email: Type.String({ minLength: 3, maxLength: 320 }),
    password: Type.String({ minLength: 8, maxLength: 200 }),
  },
  { additionalProperties: false, $id: 'LoginRequest' },
)

export const SessionResponseSchema = Type.Object(
  {
    user: CurrentUserSchema,
    expiresAt: DateTimeSchema,
  },
  { additionalProperties: false, $id: 'SessionResponse' },
)

export type CurrentUser = Static<typeof CurrentUserSchema>
export type LoginRequest = Static<typeof LoginRequestSchema>
export type SessionResponse = Static<typeof SessionResponseSchema>
export type UserRole = Static<typeof UserRoleSchema>
