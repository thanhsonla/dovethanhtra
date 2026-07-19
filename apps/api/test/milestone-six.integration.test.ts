import { randomUUID } from 'node:crypto'

import { hash } from '@node-rs/argon2'
import type { AdminArea } from '@dove/contracts'
import { sql } from 'kysely'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildApp } from '../src/app.js'
import { createDatabase, type DatabaseHandle } from '../src/platform/database.js'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required for integration tests.')

let database: DatabaseHandle
let app: Awaited<ReturnType<typeof buildApp>>

beforeAll(async () => {
  database = createDatabase(databaseUrl)
  app = await buildApp({
    auth: { cookieSecure: false, sessionTtlHours: 1 },
    dependencies: { database, objectStorage: { check: async () => true } },
    security: { loginRequestsPerMinute: 5 },
  })
})

afterAll(async () => {
  await app.close()
  await database.destroy()
})

async function login(email: string, password: string) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password },
  })
  expect(response.statusCode).toBe(200)
  const session = response.cookies.find((item) => item.name === 'dove_session')!
  const csrf = response.cookies.find((item) => item.name === 'dove_csrf')!
  return {
    cookie: `dove_session=${session.value}; dove_csrf=${csrf.value}`,
    headers: {
      cookie: `dove_session=${session.value}; dove_csrf=${csrf.value}`,
      'x-csrf-token': csrf.value,
    },
  }
}

describe('Milestone 6 security release gates', () => {
  it('prevents IDOR reads and mutations across owners', async () => {
    const owner = await login(
      process.env.BOOTSTRAP_OWNER_EMAIL!,
      process.env.BOOTSTRAP_OWNER_PASSWORD!,
    )
    const suffix = randomUUID().slice(0, 8)
    const otherEmail = `viewer-${suffix}@example.local`
    const otherPassword = `local-test-${suffix}`
    await sql`INSERT INTO app_user (email,display_name,password_hash,role)
      VALUES (${otherEmail},'Người dùng kiểm thử',${await hash(otherPassword)},'owner')`.execute(
      database.query,
    )
    const other = await login(otherEmail, otherPassword)
    const areas = (
      await app.inject({
        headers: { cookie: owner.cookie },
        method: 'GET',
        url: '/api/v1/admin-areas',
      })
    ).json<AdminArea[]>()
    const created = await app.inject({
      headers: owner.headers,
      method: 'POST',
      url: '/api/v1/cases',
      payload: {
        adminAreaId: areas[0]!.id,
        caseCode: `M6-SEC-${suffix}`,
        name: `Security ${suffix}`,
        periodEnd: '2026-07-31',
        periodStart: '2026-07-01',
      },
    })
    const caseId = created.json<{ id: string }>().id

    const read = await app.inject({
      headers: { cookie: other.cookie },
      method: 'GET',
      url: `/api/v1/cases/${caseId}`,
    })
    expect(read.statusCode).toBe(404)
    const mutation = await app.inject({
      headers: { ...other.headers, 'if-match': '"1"' },
      method: 'PATCH',
      url: `/api/v1/cases/${caseId}`,
      payload: { name: 'Không được phép' },
    })
    expect(mutation.statusCode).toBe(404)
    const comparison = await app.inject({
      headers: { cookie: other.cookie },
      method: 'GET',
      url: `/api/v1/cases/${caseId}/comparison`,
    })
    expect(comparison.statusCode).toBe(404)
    const audit = await app.inject({
      headers: { cookie: other.cookie },
      method: 'GET',
      url: `/api/v1/cases/${caseId}/audit-events`,
    })
    expect(audit.statusCode).toBe(200)
    expect(audit.json()).toEqual([])

    const copyAttemptCode = `M6-COPY-IDOR-${suffix}`
    const copyAttempt = await app.inject({
      headers: other.headers,
      method: 'POST',
      url: '/api/v1/cases',
      payload: {
        adminAreaId: areas[0]!.id,
        caseCode: copyAttemptCode,
        name: 'Không được sao chép hồ sơ khác owner',
        periodEnd: '2026-07-31',
        periodStart: '2026-07-01',
        copyStructure: { sourceCaseId: caseId },
      },
    })
    expect(copyAttempt.statusCode).toBe(404)
    expect(copyAttempt.json()).toMatchObject({ code: 'SOURCE_CASE_NOT_FOUND' })
    const rolledBackCopy = await app.inject({
      headers: { cookie: other.cookie },
      method: 'GET',
      url: `/api/v1/cases?search=${copyAttemptCode}`,
    })
    expect(rolledBackCopy.json<{ items: unknown[] }>().items).toHaveLength(0)
  })

  it('applies defensive headers and limits repeated login attempts', async () => {
    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'missing@example.local', password: 'invalid-password' },
    })
    expect(first.statusCode).toBe(401)
    expect(first.headers).toMatchObject({
      'cache-control': 'private, no-store',
      'content-security-policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
    })
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: 'missing@example.local', password: 'invalid-password' },
      })
    }
    const limited = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'missing@example.local', password: 'invalid-password' },
    })
    expect(limited.statusCode).toBe(429)
    expect(limited.json()).toMatchObject({ code: 'LOGIN_RATE_LIMITED' })
  })
})
