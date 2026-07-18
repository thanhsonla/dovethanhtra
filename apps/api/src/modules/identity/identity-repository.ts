import type { CurrentUser, UserRole } from '@dove/contracts'
import { sql } from 'kysely'

import type { AppDatabase, QueryExecutor } from '../../platform/database.js'

interface UserWithPassword extends CurrentUser {
  active: boolean
  passwordHash: string
}

interface SessionRow extends CurrentUser {
  expiresAt: Date
}

export class IdentityRepository {
  constructor(private readonly database: AppDatabase) {}

  async findUserByEmail(email: string): Promise<UserWithPassword | null> {
    const result = await sql<UserWithPassword>`
      SELECT
        id,
        email,
        display_name AS "displayName",
        password_hash AS "passwordHash",
        role,
        active
      FROM app_user
      WHERE lower(email) = lower(${email})
      LIMIT 1
    `.execute(this.database)
    return result.rows[0] ?? null
  }

  async createSession(
    executor: QueryExecutor,
    input: { userId: string; tokenHash: string; expiresAt: Date },
  ): Promise<void> {
    await sql`
      INSERT INTO app_session (user_id, token_hash, expires_at)
      VALUES (${input.userId}::uuid, ${input.tokenHash}, ${input.expiresAt})
    `.execute(executor)
  }

  async findSession(tokenHash: string): Promise<SessionRow | null> {
    const result = await sql<SessionRow>`
      SELECT
        u.id,
        u.email,
        u.display_name AS "displayName",
        u.role,
        s.expires_at AS "expiresAt"
      FROM app_session s
      JOIN app_user u ON u.id = s.user_id
      WHERE s.token_hash = ${tokenHash}
        AND s.revoked_at IS NULL
        AND s.expires_at > now()
        AND u.active = true
      LIMIT 1
    `.execute(this.database)
    return result.rows[0] ?? null
  }

  async revokeSession(tokenHash: string): Promise<void> {
    await sql`
      UPDATE app_session
      SET revoked_at = now()
      WHERE token_hash = ${tokenHash} AND revoked_at IS NULL
    `.execute(this.database)
  }

  async upsertBootstrapUser(input: {
    email: string
    displayName: string
    passwordHash: string
    role: UserRole
  }): Promise<CurrentUser> {
    const result = await sql<CurrentUser>`
      INSERT INTO app_user (email, display_name, password_hash, role)
      VALUES (${input.email}, ${input.displayName}, ${input.passwordHash}, ${input.role}::app_role)
      ON CONFLICT (lower(email)) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        password_hash = EXCLUDED.password_hash,
        role = EXCLUDED.role,
        active = true
      RETURNING id, email, display_name AS "displayName", role
    `.execute(this.database)
    const user = result.rows[0]
    if (!user) throw new Error('Không thể khởi tạo tài khoản local.')
    return user
  }
}
