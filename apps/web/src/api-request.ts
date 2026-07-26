export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string | null = null,
    public readonly details: unknown = null,
    public readonly traceId: string | null = null,
  ) {
    super(`${code ? `[${code}] ` : ''}${message}${traceId ? ` · trace ${traceId}` : ''}`)
  }
}

interface ApiRequesterDependencies {
  baseUrl: string
  fetchImpl?: typeof fetch
  readCsrfToken?: () => string
  wait?: (milliseconds: number) => Promise<void>
}

const transientStatuses = new Set([502, 503, 504])

function defaultRetryCount(method: string, headers: Headers): number {
  if (method === 'GET' || method === 'HEAD') return 2
  return headers.has('idempotency-key') ? 2 : 0
}

export function createApiRequester(dependencies: ApiRequesterDependencies) {
  const fetchImpl = dependencies.fetchImpl ?? fetch
  const readCsrfToken = dependencies.readCsrfToken ?? (() => '')
  const wait =
    dependencies.wait ??
    ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)))

  return async function request<T>(
    path: string,
    init: RequestInit = {},
    maxRetriesOverride?: number,
  ): Promise<T> {
    const method = (init.method ?? 'GET').toUpperCase()
    const headers = new Headers(init.headers)
    if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json')
    if (method !== 'GET' && method !== 'HEAD' && !headers.has('x-csrf-token')) {
      headers.set('x-csrf-token', readCsrfToken())
    }

    const maxRetries = maxRetriesOverride ?? defaultRetryCount(method, headers)
    let response: Response | null = null
    let lastError: unknown = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        response = await fetchImpl(`${dependencies.baseUrl}${path}`, {
          ...init,
          credentials: 'include',
          headers,
        })
        if (!transientStatuses.has(response.status) || attempt === maxRetries) break
      } catch (error) {
        lastError = error
        if (attempt === maxRetries) break
      }
      await wait(500 * (attempt + 1))
    }

    if (!response) {
      throw new ApiClientError(
        'Không thể kết nối tới máy chủ. Máy chủ có thể đang trong quá trình khởi động, vui lòng thử lại sau giây lát.',
        503,
        'NETWORK_ERROR',
        lastError,
      )
    }

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        code?: string
        details?: unknown
        message?: string
        traceId?: string
      } | null
      throw new ApiClientError(
        payload?.message ?? 'Yêu cầu không thành công.',
        response.status,
        payload?.code ?? null,
        payload?.details ?? null,
        payload?.traceId ?? null,
      )
    }
    if (response.status === 204) return undefined as T
    return (await response.json()) as T
  }
}

function csrfToken(): string {
  if (typeof document === 'undefined') return ''
  const item = document.cookie.split('; ').find((value) => value.startsWith('dove_csrf='))
  return item ? decodeURIComponent(item.slice('dove_csrf='.length)) : ''
}

const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api/v1'

export const request = createApiRequester({
  baseUrl: apiBase,
  readCsrfToken: csrfToken,
})
