import type { ReadinessResponse } from '@dove/contracts'

export interface ReadinessDependencies {
  database: { check(): Promise<boolean> }
  objectStorage: { check(): Promise<boolean> }
}

async function safeCheck(check: () => Promise<boolean>): Promise<boolean> {
  try {
    return await check()
  } catch {
    return false
  }
}

export function createHealthService(dependencies: ReadinessDependencies) {
  return {
    async readiness(): Promise<ReadinessResponse> {
      const [database, objectStorage] = await Promise.all([
        safeCheck(() => dependencies.database.check()),
        safeCheck(() => dependencies.objectStorage.check()),
      ])

      return {
        status: database && objectStorage ? 'ready' : 'not_ready',
        checks: { database, objectStorage },
      }
    },
  }
}
