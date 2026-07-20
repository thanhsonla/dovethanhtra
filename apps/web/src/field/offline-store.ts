import type {
  CaptureDraft,
  CreateCaptureDraftRequest,
  CreateGpsPointRequest,
  CreateGpsTrackRequest,
} from '@dove/contracts'

export interface StoredCaptureDraft {
  caseId: string
  deviceId: string
  error?: string
  idempotencyKey: string
  input: CreateCaptureDraftRequest
  localId: string
  serverDraft?: CaptureDraft
  status: 'queued' | 'syncing' | 'synced' | 'conflict' | 'failed'
  updatedAt: string
}

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
const version = 2

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, version)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('gpsDrafts')) {
        request.result.createObjectStore('gpsDrafts')
      }
      if (!request.result.objectStoreNames.contains('mutations')) {
        request.result.createObjectStore('mutations', { keyPath: 'idempotencyKey' })
      }
      if (!request.result.objectStoreNames.contains('captureDrafts')) {
        request.result.createObjectStore('captureDrafts', { keyPath: 'localId' })
      }
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
  deleteCaptureDraft: (localId: string) =>
    transact('captureDrafts', 'readwrite', (store) => store.delete(localId)),
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
  listCaptureDrafts: async (caseId: string) => {
    const items = await transact<StoredCaptureDraft[]>(
      'captureDrafts',
      'readonly',
      (store) => store.getAll() as IDBRequest<StoredCaptureDraft[]>,
    )
    return items
      .filter((item) => item.caseId === caseId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  },
  putDraft: (workItemId: string, input: CreateGpsTrackRequest) =>
    transact('gpsDrafts', 'readwrite', (store) => store.put(input, workItemId)),
  putMutation: (mutation: QueuedGpsMutation) =>
    transact('mutations', 'readwrite', (store) => store.put(mutation)),
  putCaptureDraft: (draft: StoredCaptureDraft) =>
    transact('captureDrafts', 'readwrite', (store) => store.put(draft)),
}

export function deviceId(): string {
  const key = 'dove-device-id'
  const current = localStorage.getItem(key)
  if (current) return current
  const created = crypto.randomUUID()
  localStorage.setItem(key, created)
  return created
}
