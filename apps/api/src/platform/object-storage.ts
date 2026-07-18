import { Client } from 'minio'

import type { AppConfig } from '../config.js'

export interface ObjectStorageHandle {
  check(): Promise<boolean>
  getObject?(objectKey: string): Promise<NodeJS.ReadableStream>
  presignPut?(objectKey: string, expiresSeconds: number): Promise<string>
  remove?(objectKey: string): Promise<void>
  stat?(objectKey: string): Promise<{ size: number; contentType: string | null }>
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
    getObject: (objectKey) => client.getObject(config.bucket, objectKey),
    presignPut: (objectKey, expiresSeconds) =>
      client.presignedPutObject(config.bucket, objectKey, expiresSeconds),
    remove: (objectKey) => client.removeObject(config.bucket, objectKey),
    async stat(objectKey) {
      const result = await client.statObject(config.bucket, objectKey)
      const metadata = result.metaData as Record<string, unknown>
      const contentType = metadata['content-type']
      return {
        size: result.size,
        contentType: typeof contentType === 'string' ? contentType : null,
      }
    },
  }
}
