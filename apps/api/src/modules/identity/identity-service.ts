import { verify } from '@node-rs/argon2'
import type { CurrentUser } from '@dove/contracts'

import { AppError } from '../../platform/app-error.js'
import type { AppDatabase } from '../../platform/database.js'
import { randomToken, sha256 } from '../../platform/crypto.js'
import type { IdentityRepository } from './identity-repository.js'

export interface AuthSession {
  expiresAt: string
  token: string
  user: CurrentUser
}

export class IdentityService {
  constructor(
    private readonly database: AppDatabase,
    private readonly repository: IdentityRepository,
    private readonly sessionTtlHours: number,
  ) {}

  async login(email: string, password: string): Promise<AuthSession> {
    const user = await this.repository.findUserByEmail(email)
    if (!user?.active || !(await verify(user.passwordHash, password))) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng.')
    }

    const token = randomToken()
    const expiresAt = new Date(Date.now() + this.sessionTtlHours * 60 * 60 * 1000)
    await this.database.transaction().execute(async (transaction) => {
      await this.repository.createSession(transaction, {
        userId: user.id,
        tokenHash: sha256(token),
        expiresAt,
      })
    })

    return {
      token,
      expiresAt: expiresAt.toISOString(),
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
    }
  }

  async authenticate(token: string | undefined): Promise<Omit<AuthSession, 'token'>> {
    if (!token) throw new AppError(401, 'AUTH_REQUIRED', 'Bạn cần đăng nhập để tiếp tục.')
    const session = await this.repository.findSession(sha256(token))
    if (!session) throw new AppError(401, 'SESSION_INVALID', 'Phiên đăng nhập đã hết hạn.')
    const { expiresAt, ...user } = session
    return { user, expiresAt: expiresAt.toISOString() }
  }

  async logout(token: string | undefined): Promise<void> {
    if (token) await this.repository.revokeSession(sha256(token))
  }
}
