import type { IncomingMessage, ServerResponse } from 'node:http'
import { buildApp } from '../apps/api/src/app.js'
import { loadConfig } from '../apps/api/src/config.js'
import { createDatabase } from '../apps/api/src/platform/database.js'
import { createObjectStorage } from '../apps/api/src/platform/object-storage.js'
import { LocalRoutingProvider } from '../apps/api/src/modules/routing/local-routing-provider.js'

// Đặt mặc định Supabase Database URL nếu biến môi trường Vercel chưa có
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://postgres.uqajicuudasoluzopius:C9s7%40uRy%3Fv3%24%40%24%40@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require'

let appPromise: Promise<any> | null = null

function initApp() {
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

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await initApp()
  app.server.emit('request', req, res)
}
