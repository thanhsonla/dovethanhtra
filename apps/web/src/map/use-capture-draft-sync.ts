import type {
  CreateCaptureDraftRequest,
  DrawableMeasurementGeometryKind,
  GeoJsonGeometry,
} from '@dove/contracts'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { api, ApiClientError } from '../api.js'
import { deviceId, offlineStore, type StoredCaptureDraft } from '../field/offline-store.js'

function withStatus(
  draft: StoredCaptureDraft,
  status: StoredCaptureDraft['status'],
  error?: string,
): StoredCaptureDraft {
  const next = { ...draft, status, updatedAt: new Date().toISOString() }
  if (error) next.error = error
  else delete next.error
  return next
}

export function useCaptureDraftSync(caseId: string, onError: (message: string) => void) {
  const [drafts, setDrafts] = useState<StoredCaptureDraft[]>([])

  const replace = useCallback((draft: StoredCaptureDraft) => {
    setDrafts((items) => [draft, ...items.filter((item) => item.localId !== draft.localId)])
  }, [])

  const sync = useCallback(
    async (draft: StoredCaptureDraft) => {
      const syncing = withStatus(draft, 'syncing')
      await offlineStore.putCaptureDraft(syncing)
      replace(syncing)
      try {
        const response = await api.createCaptureDraft(
          caseId,
          syncing.input,
          syncing.idempotencyKey,
          syncing.deviceId,
        )
        const synced = withStatus({ ...syncing, serverDraft: response.draft }, 'synced')
        await offlineStore.putCaptureDraft(synced)
        replace(synced)
        return synced
      } catch (reason) {
        const status: StoredCaptureDraft['status'] =
          reason instanceof ApiClientError
            ? reason.status === 409
              ? 'conflict'
              : 'failed'
            : 'queued'
        const failed = withStatus(
          syncing,
          status,
          reason instanceof Error ? reason.message : 'Chưa thể đồng bộ nháp.',
        )
        await offlineStore.putCaptureDraft(failed)
        replace(failed)
        if (status !== 'queued') onError(failed.error ?? 'Không thể đồng bộ nháp.')
        return failed
      }
    },
    [caseId, onError, replace],
  )

  useEffect(() => {
    void Promise.all([
      offlineStore.listCaptureDrafts(caseId),
      navigator.onLine ? api.listCaptureDrafts(caseId).catch(() => []) : Promise.resolve([]),
    ]).then(([local, remote]) => {
      const localIds = new Set(local.map((item) => item.localId))
      const remoteOnly: StoredCaptureDraft[] = remote
        .filter((item) => !localIds.has(item.localId) && item.status === 'unclassified')
        .map((item) => ({
          caseId,
          deviceId: item.deviceId,
          idempotencyKey: `server:${item.id}`,
          input: {
            geometry: item.rawGeometry,
            geometryKind: item.geometryKind,
            localId: item.localId,
            metadata: item.metadata,
            method: item.method,
          },
          localId: item.localId,
          serverDraft: item,
          status: 'synced',
          updatedAt: item.updatedAt,
        }))
      setDrafts([...local, ...remoteOnly].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))
    })
  }, [caseId])

  useEffect(() => {
    const flush = () => {
      void offlineStore.listCaptureDrafts(caseId).then((items) => {
        items.filter((item) => item.status === 'queued').forEach((item) => void sync(item))
      })
    }
    window.addEventListener('online', flush)
    if (navigator.onLine) flush()
    return () => window.removeEventListener('online', flush)
  }, [caseId, sync])

  const save = useCallback(
    async (kind: DrawableMeasurementGeometryKind, geometry: GeoJsonGeometry) => {
      const localId = crypto.randomUUID()
      const input: CreateCaptureDraftRequest = {
        geometry,
        geometryKind: kind,
        localId,
        metadata: { capturedAt: new Date().toISOString(), clientWorkflow: 'map-first-task-6' },
        method: 'map_draw',
      }
      const draft: StoredCaptureDraft = {
        caseId,
        deviceId: deviceId(),
        idempotencyKey: `capture-${localId}`,
        input,
        localId,
        status: 'queued',
        updatedAt: new Date().toISOString(),
      }
      await offlineStore.putCaptureDraft(draft)
      replace(draft)
      return navigator.onLine ? sync(draft) : draft
    },
    [caseId, replace, sync],
  )

  return { drafts, latest: useMemo(() => drafts[0] ?? null, [drafts]), save }
}
