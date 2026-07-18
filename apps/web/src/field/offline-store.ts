import type { CreateGpsPointRequest, CreateGpsTrackRequest } from '@dove/contracts'

interface QueuedGpsMutationBase {
  deviceId: string
  idempotencyKey: string
  status: 'queued' | 'syncing' | 'conflict' | 'failed'
  workItemId: string
  error?: string
}
export type QueuedGpsMutation =
  | (QueuedGpsMutationBase & { kind: 'point'; input: CreateGpsPointRequest })
  | (QueuedGpsMutationBase & { kind: 'track'; input: CreateGpsTrackRequest })

const databaseName = 'dove-field-v4'
const version = 1

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, version)
    request.onupgradeneeded = () => {
      request.result.createObjectStore('gpsDrafts')
      request.result.createObjectStore('mutations', { keyPath: 'idempotencyKey' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Không thể mở IndexedDB.'))
  })
}

async function transact<T>(
  storeName: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await open()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode)
    const request = action(transaction.objectStore(storeName))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Thao tác IndexedDB thất bại.'))
    transaction.oncomplete = () => database.close()
  })
}

export const offlineStore = {
  deleteDraft: (workItemId: string) =>
    transact('gpsDrafts', 'readwrite', (store) => store.delete(workItemId)),
  deleteMutation: (key: string) => transact('mutations', 'readwrite', (store) => store.delete(key)),
  getDraft: (workItemId: string) =>
    transact<CreateGpsTrackRequest | undefined>(
      'gpsDrafts',
      'readonly',
      (store) => store.get(workItemId) as IDBRequest<CreateGpsTrackRequest | undefined>,
    ),
  listMutations: () =>
    transact<QueuedGpsMutation[]>(
      'mutations',
      'readonly',
      (store) => store.getAll() as IDBRequest<QueuedGpsMutation[]>,
    ),
  putDraft: (workItemId: string, input: CreateGpsTrackRequest) =>
    transact('gpsDrafts', 'readwrite', (store) => store.put(input, workItemId)),
  putMutation: (mutation: QueuedGpsMutation) =>
    transact('mutations', 'readwrite', (store) => store.put(mutation)),
}

export function deviceId(): string {
  const key = 'dove-device-id'
  const current = localStorage.getItem(key)
  if (current) return current
  const created = crypto.randomUUID()
  localStorage.setItem(key, created)
  return created
}
