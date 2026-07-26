import { describe, expect, it, vi } from 'vitest'

import type { ApiClientError } from './api-request.js'
import { createApiRequester } from './api-request.js'

describe('API requester', () => {
  it('retries transient GET failures used while the API is warming', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'ok' }), {
          headers: { 'content-type': 'application/json' },
          status: 200,
        }),
      )
    const request = createApiRequester({
      baseUrl: '/api/v1',
      fetchImpl,
      wait: async () => undefined,
    })

    await expect(request<{ status: string }>('/health/live')).resolves.toEqual({ status: 'ok' })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('does not replay a non-idempotent login request after a network failure', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('network unavailable'))
    const request = createApiRequester({
      baseUrl: '/api/v1',
      fetchImpl,
      readCsrfToken: () => 'csrf',
      wait: async () => undefined,
    })

    await expect(
      request('/auth/login', {
        body: JSON.stringify({ email: 'owner@example.local', password: 'secret' }),
        method: 'POST',
      }),
    ).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      status: 503,
    } satisfies Partial<ApiClientError>)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('retries mutations only when they carry an idempotency key', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError('connection reset'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'draft-1' }), {
          headers: { 'content-type': 'application/json' },
          status: 200,
        }),
      )
    const request = createApiRequester({
      baseUrl: '/api/v1',
      fetchImpl,
      readCsrfToken: () => 'csrf',
      wait: async () => undefined,
    })

    await expect(
      request<{ id: string }>('/capture-drafts', {
        body: '{}',
        headers: { 'idempotency-key': 'stable-key' },
        method: 'POST',
      }),
    ).resolves.toEqual({ id: 'draft-1' })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })
})
