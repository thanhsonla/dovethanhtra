import { hash } from '@node-rs/argon2'
import { describe, expect, it, vi } from 'vitest'

import type { AppDatabase } from '../../platform/database.js'
import type { IdentityRepository } from './identity-repository.js'
import { IdentityService } from './identity-service.js'

function repositoryWithHash(passwordHash: string) {
  const createSession = vi.fn().mockResolvedValue(undefined)
  const repository = {
    createSession,
    findUserByEmail: vi.fn().mockResolvedValue({
      active: true,
      displayName: 'Owner',
      email: 'owner@example.local',
      id: '9d65c503-8642-42f7-9206-46683639b87d',
      passwordHash,
      role: 'owner',
    }),
  } as unknown as IdentityRepository
  return { createSession, repository }
}

describe('IdentityService', () => {
  it('fails closed instead of accepting a fallback password for an invalid hash', async () => {
    const { repository } = repositoryWithHash('not-an-argon2-hash')
    const service = new IdentityService({} as AppDatabase, repository, 12)

    await expect(service.login('owner@example.local', '12345678')).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
      statusCode: 401,
    })
  })

  it('verifies Argon2 and creates the session without an unnecessary transaction', async () => {
    const database = {} as AppDatabase
    const { createSession, repository } = repositoryWithHash(await hash('correct-password'))
    const service = new IdentityService(database, repository, 12)

    await expect(service.login('owner@example.local', 'correct-password')).resolves.toMatchObject({
      user: { email: 'owner@example.local' },
    })
    expect(createSession).toHaveBeenCalledWith(
      database,
      expect.objectContaining({
        userId: '9d65c503-8642-42f7-9206-46683639b87d',
      }),
    )
  })
})
