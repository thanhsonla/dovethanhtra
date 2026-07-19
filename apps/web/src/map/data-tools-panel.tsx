import type { GeoJsonImportPreview, Measurement, WorkItem } from '@dove/contracts'
import { useEffect, useState } from 'react'

import { api } from '../api.js'

const errorMessage = (reason: unknown) =>
  reason instanceof Error ? reason.message : 'Không thể xử lý dữ liệu.'

export function DataToolsPanel(props: {
  allowImport: boolean
  onChanged(measurement?: Measurement): Promise<void>
  onError(message: string): void
  workItem: WorkItem | null
}) {
  const [collection, setCollection] = useState<unknown>(null)
  const [sourceName, setSourceName] = useState('')
  const [nameProperty, setNameProperty] = useState('name')
  const [preview, setPreview] = useState<GeoJsonImportPreview | null>(null)
  const [deleted, setDeleted] = useState<Measurement[]>([])
  const [reason, setReason] = useState('Phục hồi theo yêu cầu người dùng')
  const workItemId = props.workItem?.id

  useEffect(() => {
    setCollection(null)
    setPreview(null)
    setDeleted([])
  }, [workItemId])

  if (!props.workItem) return null

  const loadFile = async (file: File | undefined) => {
    setPreview(null)
    setCollection(null)
    if (!file) return
    if (file.size > 5_000_000) return props.onError('GeoJSON vượt giới hạn 5 MB.')
    try {
      setCollection(JSON.parse(await file.text()) as unknown)
      setSourceName(file.name)
    } catch {
      props.onError('Tệp không phải JSON hợp lệ.')
    }
  }

  return (
    <section className="data-tools-panel">
      {props.allowImport && (
        <details>
          <summary>Import GeoJSON</summary>
          <label>
            Tệp GeoJSON
            <input
              accept=".geojson,application/geo+json,application/json"
              type="file"
              onChange={(event) => void loadFile(event.target.files?.[0])}
            />
          </label>
          <label>
            Thuộc tính dùng làm tên
            <input
              value={nameProperty}
              maxLength={100}
              onChange={(event) => setNameProperty(event.target.value)}
            />
          </label>
          <button
            className="button button--quiet"
            disabled={!collection}
            onClick={() =>
              void api
                .previewGeoJsonImport(props.workItem!.id, {
                  collection,
                  sourceName,
                  ...(nameProperty ? { nameProperty } : {}),
                })
                .then(setPreview)
                .catch((reason) => props.onError(errorMessage(reason)))
            }
          >
            Preview và kiểm schema
          </button>
          {preview && (
            <div className="import-preview">
              <strong>
                {preview.featureCount} feature · {preview.geometryKind}
              </strong>
              <small>SHA-256: {preview.sourceHash}</small>
              <small>
                Trường:{' '}
                {preview.detectedSchema
                  .map((item) => `${item.name}:${item.types.join('|')}`)
                  .join(', ') || 'không có'}
              </small>
              <small>Mẫu tên: {preview.sampleNames.join(', ')}</small>
              <button
                className="button"
                onClick={() =>
                  void api
                    .commitGeoJsonImport(props.workItem!.id, {
                      collection,
                      sourceName,
                      expectedHash: preview.sourceHash,
                      ...(nameProperty ? { nameProperty } : {}),
                    })
                    .then(async () => {
                      setCollection(null)
                      setPreview(null)
                      await props.onChanged()
                    })
                    .catch((reason) => props.onError(errorMessage(reason)))
                }
              >
                Import chính thức
              </button>
            </div>
          )}
        </details>
      )}
      <details
        onToggle={(event) => {
          if (event.currentTarget.open)
            void api
              .listDeletedMeasurements(props.workItem!.id)
              .then(setDeleted)
              .catch((error) => props.onError(errorMessage(error)))
        }}
      >
        <summary>Phép đo đã xóa</summary>
        <label>
          Lý do phục hồi
          <input value={reason} onChange={(event) => setReason(event.target.value)} />
        </label>
        {deleted.length === 0 && <p className="empty">Không có phép đo đã xóa.</p>}
        {deleted.map((item) => (
          <div className="deleted-record" key={item.id}>
            <span>
              <strong>{item.name}</strong>
              <small>{item.code}</small>
            </span>
            <button
              className="button button--quiet"
              disabled={reason.trim().length < 3}
              onClick={() =>
                void api
                  .restoreMeasurement(item.id, reason)
                  .then(async (restored) => {
                    setDeleted((current) => current.filter((entry) => entry.id !== item.id))
                    await props.onChanged(restored)
                  })
                  .catch((error) => props.onError(errorMessage(error)))
              }
            >
              Phục hồi
            </button>
          </div>
        ))}
      </details>
    </section>
  )
}
