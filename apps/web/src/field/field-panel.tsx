import type {
  CreateGpsPointRequest,
  CreateGpsTrackRequest,
  GpsPoint,
  Measurement,
  WorkItem,
} from '@dove/contracts'
import { useEffect, useMemo, useRef, useState } from 'react'

import { api } from '../api.js'
import { deviceId, offlineStore, type QueuedGpsMutation } from './offline-store.js'

const hex = (buffer: ArrayBuffer) =>
  [...new Uint8Array(buffer)].map((value) => value.toString(16).padStart(2, '0')).join('')

function pointFromPosition(position: GeolocationPosition): GpsPoint {
  const now = Date.now()
  const timestamp =
    Number.isFinite(position.timestamp) &&
    position.timestamp >= Date.UTC(2000, 0, 1) &&
    position.timestamp <= now + 60_000
      ? position.timestamp
      : now
  return {
    position: [position.coords.longitude, position.coords.latitude],
    recordedAt: new Date(timestamp).toISOString(),
    accuracyM: Number.isFinite(position.coords.accuracy)
      ? Math.min(10000, Math.max(0, position.coords.accuracy))
      : 1000,
    ...(typeof position.coords.altitude === 'number' && Number.isFinite(position.coords.altitude)
      ? { altitudeM: position.coords.altitude }
      : {}),
    ...(typeof position.coords.speed === 'number' && Number.isFinite(position.coords.speed)
      ? { speedMps: Math.max(0, position.coords.speed) }
      : {}),
  }
}

export function FieldPanel(props: {
  measurement: Measurement | null
  onChanged(measurement: Measurement): Promise<void>
  onError(value: string): void
  gpsKind: 'line' | 'point' | null
  workItem: WorkItem | null
}) {
  const [segments, setSegments] = useState<GpsPoint[][]>([[]])
  const [recording, setRecording] = useState(false)
  const [paused, setPaused] = useState(false)
  const [syncState, setSyncState] = useState('synced')
  const [photoState, setPhotoState] = useState('')
  const watchId = useRef<number | null>(null)
  const pausedRef = useRef(false)
  const pointCount = useMemo(
    () => segments.reduce((sum, segment) => sum + segment.length, 0),
    [segments],
  )

  useEffect(() => {
    if (!props.workItem || props.gpsKind !== 'line') return
    void offlineStore.getDraft(props.workItem.id).then((draft) => {
      if (draft) {
        setSegments(draft.segments)
        setSyncState('local_only')
      }
    })
  }, [props.workItem?.id, props.gpsKind])

  const draft = (): CreateGpsTrackRequest | null => {
    if (!props.workItem) return null
    const valid = segments.filter((segment) => segment.length >= 2)
    if (!valid.length) return null
    return {
      localId: crypto.randomUUID(),
      name: `GPS ${new Date().toLocaleString('vi-VN')}`,
      segments: valid,
      accuracyThresholdM: 30,
      note: null,
    }
  }

  const persist = async (next: GpsPoint[][]) => {
    if (!props.workItem) return
    const valid = next.filter((segment) => segment.length >= 2)
    if (!valid.length) return
    await offlineStore.putDraft(props.workItem.id, {
      localId: `draft-${props.workItem.id}`,
      name: 'GPS draft hiện trường',
      segments: valid,
      accuracyThresholdM: 30,
      note: null,
    })
    setSyncState('local_only')
  }

  const start = () => {
    if (!navigator.geolocation) return props.onError('Thiết bị không hỗ trợ GPS.')
    setRecording(true)
    setPaused(false)
    pausedRef.current = false
    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        const point = pointFromPosition(position)
        setSegments((current) => {
          if (pausedRef.current) return current
          const next = current.map((segment) => [...segment])
          next[next.length - 1]!.push(point)
          void persist(next)
          return next
        })
        props.onError('')
      },
      (error) => props.onError(`Không đọc được GPS: ${error.message}`),
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000,
      },
    )
  }

  const stopWatch = () => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current)
    watchId.current = null
    setRecording(false)
    setPaused(false)
    pausedRef.current = false
  }
  useEffect(
    () => () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current)
    },
    [],
  )

  const togglePause = () => {
    if (paused) {
      setSegments((current) => [...current, []])
      setPaused(false)
      pausedRef.current = false
    } else {
      setPaused(true)
      pausedRef.current = true
    }
  }

  const sync = async (mutation: QueuedGpsMutation) => {
    try {
      setSyncState('syncing')
      const result =
        mutation.kind === 'point'
          ? await api.createGpsPoint(
              mutation.workItemId,
              mutation.input,
              mutation.idempotencyKey,
              mutation.deviceId,
            )
          : await api.createGpsTrack(
              mutation.workItemId,
              mutation.input,
              mutation.idempotencyKey,
              mutation.deviceId,
            )
      await offlineStore.deleteMutation(mutation.idempotencyKey)
      await offlineStore.deleteDraft(mutation.workItemId)
      setSyncState('synced')
      await props.onChanged(result.measurement)
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Đồng bộ thất bại.'
      const conflict = message.includes('khóa') || message.includes('dữ liệu khác')
      await offlineStore.putMutation({
        ...mutation,
        status: conflict ? 'conflict' : 'failed',
        error: message,
      })
      setSyncState(conflict ? 'conflict' : 'failed')
      props.onError(message)
    }
  }

  const save = async () => {
    const input = draft()
    if (!input || !props.workItem)
      return props.onError('GPS track cần ít nhất hai điểm trong một đoạn.')
    stopWatch()
    const mutation: QueuedGpsMutation = {
      deviceId: deviceId(),
      idempotencyKey: crypto.randomUUID(),
      input,
      kind: 'track',
      status: 'queued',
      workItemId: props.workItem.id,
    }
    await offlineStore.putMutation(mutation)
    setSyncState('queued')
    if (navigator.onLine) await sync(mutation)
  }

  const recordPoint = () => {
    if (!navigator.geolocation || !props.workItem)
      return props.onError('Thiết bị không hỗ trợ GPS.')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const input: CreateGpsPointRequest = {
          localId: crypto.randomUUID(),
          name: `Vị trí GPS ${new Date().toLocaleString('vi-VN')}`,
          point: pointFromPosition(position),
          accuracyThresholdM: 30,
          note: null,
        }
        const mutation: QueuedGpsMutation = {
          deviceId: deviceId(),
          idempotencyKey: crypto.randomUUID(),
          input,
          kind: 'point',
          status: 'queued',
          workItemId: props.workItem!.id,
        }
        void offlineStore.putMutation(mutation).then(async () => {
          setSyncState('queued')
          if (navigator.onLine) await sync(mutation)
        })
      },
      (error) => props.onError(`Không đọc được GPS: ${error.message}`),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    )
  }

  useEffect(() => {
    const flush = () =>
      void offlineStore
        .listMutations()
        .then((items) => Promise.all(items.filter((item) => item.status !== 'conflict').map(sync)))
    window.addEventListener('online', flush)
    return () => window.removeEventListener('online', flush)
  }, [])

  const uploadPhoto = async (file: File) => {
    if (!props.measurement && !props.workItem) return
    try {
      setPhotoState('Đang tính hash…')
      const sha256 = hex(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()))
      const presigned = await api.presignAttachment({
        ...(props.measurement
          ? { measurementId: props.measurement.id }
          : { workItemId: props.workItem!.id }),
        originalName: file.name,
        mimeType: file.type as 'image/jpeg' | 'image/png' | 'image/webp',
        sizeBytes: file.size,
        sha256,
      })
      setPhotoState('Đang tải ảnh gốc…')
      const upload = await fetch(presigned.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'content-type': file.type },
      })
      if (!upload.ok) throw new Error('MinIO từ chối upload ảnh.')
      const completed = await api.completeAttachment(presigned.attachment.id)
      setPhotoState(`Đã lưu ảnh · ${completed.sha256?.slice(0, 12)}…`)
    } catch (reason) {
      setPhotoState('Ảnh chưa hoàn tất')
      props.onError(reason instanceof Error ? reason.message : 'Không thể tải ảnh.')
    }
  }

  return (
    <section className="field-panel">
      <p className="section-kicker">Hiện trường · Mốc 4</p>
      {props.gpsKind === 'point' && props.workItem && (
        <div className="gps-controls">
          <strong>Vị trí GPS hiện tại</strong>
          <span>Đồng bộ: {syncState}</span>
          <button className="button" onClick={recordPoint}>
            Ghi vị trí GPS
          </button>
        </div>
      )}
      {props.gpsKind === 'line' && props.workItem && (
        <div className="gps-controls">
          <strong>GPS track: {pointCount} điểm</strong>
          <span>Đồng bộ: {syncState}</span>
          <div className="button-row">
            {!recording && (
              <button className="button" onClick={start}>
                Bắt đầu GPS
              </button>
            )}
            {recording && (
              <button className="button" onClick={togglePause}>
                {paused ? 'Tiếp tục' : 'Tạm dừng'}
              </button>
            )}
            {recording && (
              <button className="button button--quiet" onClick={() => void save()}>
                Kết thúc và lưu
              </button>
            )}
          </div>
        </div>
      )}
      {(props.measurement || props.workItem) && (
        <label className="photo-field">
          Ảnh hiện trường
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void uploadPhoto(file)
            }}
          />
          {photoState && <small>{photoState}</small>}
        </label>
      )}
    </section>
  )
}
