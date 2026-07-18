import { Client } from 'minio'

import type { AppConfig } from '../config.js'

export interface ObjectStorageHandle {
  check(): Promise<boolean>
}

export function createObjectStorage(config: AppConfig['objectStorage']): ObjectStorageHandle {
  const client = new Client({
    endPoint: config.endPoint,
    port: config.port,
    useSSL: config.useSSL,
    accessKey: config.accessKey,
    secretKey: config.secretKey,
  })

  return {
    check: () => client.bucketExists(config.bucket),
  }
}
