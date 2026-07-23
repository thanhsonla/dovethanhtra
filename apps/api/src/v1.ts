import type { IncomingMessage, ServerResponse } from 'node:http'
import type { FastifyInstance } from 'fastify'

import { buildApp } from './app.js'
import { loadConfig } from './config.js'
import { LocalRoutingProvider } from './modules/routing/local-routing-provider.js'
import { createDatabase } from './platform/database.js'
import { createObjectStorage } from './platform/object-storage.js'

process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://postgres.uqajicuudasoluzopius:C9s7%40uRy%3Fv3%24%40%24%40@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require'

let appPromise: Promise<FastifyInstance> | null = null

function initApp(): Promise<FastifyInstance> {
  if (!appPromise) {
    appPromise = (async () => {
      const config = loadConfig()
      const database = createDatabase(config.databaseUrl)
      const objectStorage = createObjectStorage(config.objectStorage)
      const routingProvider = new LocalRoutingProvider()

      const app = await buildApp({
        auth: config.auth,
        basemaps: { googleMapTiles: null },
        dependencies: { database, objectStorage },
        logger: { level: 'info' },
        routing: { provider: routingProvider, requestsPerMinute: 60 },
        security: config.security,
      })

      await app.ready()
      return app
    })()
  }
  return appPromise
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const app = await initApp()
    app.server.emit('request', req, res)
  } catch (err: unknown) {
    const error = err as Error
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(
      JSON.stringify({
        error: error?.message || String(err),
        stack: error?.stack,
      }),
    )
  }
}
