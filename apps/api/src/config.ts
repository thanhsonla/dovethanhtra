export interface AppConfig {
  apiHost: string
  apiPort: number
  databaseUrl: string
  logLevel: string
  auth: {
    cookieSecure: boolean
    sessionTtlHours: number
  }
  objectStorage: {
    bucket: string
    endPoint: string
    port: number
    useSSL: boolean
    accessKey: string
    secretKey: string
  }
  routing: {
    provider: 'local' | 'mapbox'
    mapboxAccessToken: string | null
    requestsPerMinute: number
    timeoutMs: number
  }
  security: { loginRequestsPerMinute: number }
}

function required(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function positiveInteger(environment: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = environment[name] ?? String(fallback)
  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`Invalid positive integer in environment variable: ${name}`)
  }
  return parsed
}

function port(environment: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const value = positiveInteger(environment, name, fallback)
  if (value > 65_535) throw new Error(`Invalid port in environment variable: ${name}`)
  return value
}

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    apiHost: environment.API_HOST ?? '0.0.0.0',
    apiPort: port(environment, 'API_PORT', 3000),
    databaseUrl: required(environment, 'DATABASE_URL'),
    logLevel: environment.LOG_LEVEL ?? 'info',
    auth: {
      cookieSecure: environment.COOKIE_SECURE === 'true',
      sessionTtlHours: positiveInteger(environment, 'SESSION_TTL_HOURS', 12),
    },
    objectStorage: {
      bucket: required(environment, 'MINIO_BUCKET'),
      endPoint: environment.MINIO_ENDPOINT ?? '127.0.0.1',
      port: port(environment, 'MINIO_PORT', 9000),
      useSSL: environment.MINIO_USE_SSL === 'true',
      accessKey: required(environment, 'MINIO_ROOT_USER'),
      secretKey: required(environment, 'MINIO_ROOT_PASSWORD'),
    },
    routing: {
      provider: environment.ROUTING_PROVIDER === 'mapbox' ? 'mapbox' : 'local',
      mapboxAccessToken: environment.MAPBOX_ACCESS_TOKEN || null,
      requestsPerMinute: positiveInteger(environment, 'ROUTING_REQUESTS_PER_MINUTE', 30),
      timeoutMs: positiveInteger(environment, 'ROUTING_TIMEOUT_MS', 8000),
    },
    security: {
      loginRequestsPerMinute: positiveInteger(environment, 'LOGIN_REQUESTS_PER_MINUTE', 5),
    },
  }
}
