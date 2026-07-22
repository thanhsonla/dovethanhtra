import type { ManagementZone, MapFeature, ServiceGroup, WorkItem, WorkType } from '@dove/contracts'
import { useEffect, useMemo, useRef, useState } from 'react'

import { api } from '../api.js'
import { measurementBaseValue } from './measurement-summary.js'

const COLOR_PALETTE = [
  { name: 'Xanh lá', value: '#10b981' },
  { name: 'Đỏ', value: '#ef4444' },
  { name: 'Cam', value: '#f97316' },
  { name: 'Vàng', value: '#eab308' },
  { name: 'Xanh dương', value: '#3b82f6' },
  { name: 'Tím', value: '#8b5cf6' },
  { name: 'Đen', value: '#1e293b' },
]

function noteMetadata(note: string | null): Record<string, unknown> | null {
  if (!note?.startsWith('{')) return null
  try {
    const value: unknown = JSON.parse(note)
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

function createdDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/u.exec(value)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '—'
}

export function MapFeatureCard(props: {
  feature: MapFeature
  groups?: ServiceGroup[] | undefined
  onClose(): void
  onEdit?: (() => void) | undefined
  onRefresh?: (() => Promise<void> | void) | undefined
  onRemoveFeature?: ((measurementId: string) => void) | undefined
  onReplaceFeature?: ((previousId: string, feature: MapFeature) => void) | undefined
  onWorkChanged?: ((item: WorkItem) => void) | undefined
  workItem?: WorkItem | null | undefined
  workTypes?: WorkType[] | undefined
  zones?: ManagementZone[] | undefined
}) {
  const item = props.feature.measurement
  const noteData = noteMetadata(item.note)
  const initialColor = (noteData?.color as string | undefined) ?? '#10b981'
  const [selectedColor, setSelectedColor] = useState(initialColor)
  const [isEditing, setIsEditing] = useState(false)
  const [nameInput, setNameInput] = useState(item.name)
  const [zoneInput, setZoneInput] = useState(props.feature.managementZoneId ?? '')
  const [groupInput, setGroupInput] = useState(props.feature.serviceGroupId)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const colorTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (colorTimer.current) clearTimeout(colorTimer.current)
    },
    [],
  )

  const compatibleGroups = useMemo(() => {
    const workTypes = props.workTypes ?? []
    return (props.groups ?? []).filter((group) =>
      workTypes.some(
        (workType) =>
          workType.active &&
          workType.serviceGroupId === group.id &&
          workType.measurementKind === item.geometryKind,
      ),
    )
  }, [item.geometryKind, props.groups, props.workTypes])

  const replaceFeature = (previousId: string, feature: MapFeature) => {
    props.onReplaceFeature?.(previousId, feature)
  }

  const cancelEdit = () => {
    setNameInput(item.name)
    setZoneInput(props.feature.managementZoneId ?? '')
    setGroupInput(props.feature.serviceGroupId)
    setIsEditing(false)
  }

  const handleSaveDetails = async (event: React.FormEvent) => {
    event.preventDefault()
    const name = nameInput.trim()
    if (!name) return

    const group = compatibleGroups.find((candidate) => candidate.id === groupInput)
    const zone = props.zones?.find((candidate) => candidate.id === zoneInput) ?? null
    const workType = props.workTypes?.find(
      (candidate) =>
        candidate.active &&
        candidate.serviceGroupId === groupInput &&
        candidate.measurementKind === item.geometryKind,
    )
    const optimistic: MapFeature = {
      ...props.feature,
      managementZoneId: zoneInput || null,
      managementZoneName: zone?.name ?? null,
      measurement: { ...item, name },
      serviceGroupId: groupInput,
      serviceGroupName: group?.name ?? props.feature.serviceGroupName,
    }
    replaceFeature(item.id, optimistic)

    try {
      setIsSubmitting(true)
      setError(null)
      let nextFeature = optimistic
      const classificationChanged =
        zoneInput !== (props.feature.managementZoneId ?? '') ||
        groupInput !== props.feature.serviceGroupId

      if (classificationChanged) {
        if (!props.workItem || !workType) throw new Error('Không tìm thấy loại công tác phù hợp.')
        const updatedWork = await api.updateWorkItem(props.workItem, {
          managementZoneId: zoneInput || null,
          workTypeId: workType.id,
        })
        props.onWorkChanged?.(updatedWork)
      }

      if (name !== item.name) {
        const updatedMeasurement = await api.supersedeMeasurement(item.id, {
          calculationInputs: item.calculationInputs,
          name,
          geometryKind: item.geometryKind === 'route' ? 'line' : item.geometryKind,
          geometry: item.normalizedGeometry ?? item.rawGeometry,
          reason: 'Sửa thông tin đối tượng trên bản đồ',
          note: item.note,
        })
        nextFeature = { ...optimistic, measurement: updatedMeasurement }
        replaceFeature(item.id, nextFeature)
      }

      setIsEditing(false)
      void props.onRefresh?.()
    } catch (reason: unknown) {
      replaceFeature(item.id, props.feature)
      setError(reason instanceof Error ? reason.message : 'Không thể sửa thông tin')
      void props.onRefresh?.()
    } finally {
      setIsSubmitting(false)
    }
  }

  const commitColor = async (colorHex: string) => {
    const nextNote = JSON.stringify({ ...(noteData ?? {}), color: colorHex })
    const optimistic = { ...props.feature, measurement: { ...item, note: nextNote } }
    try {
      setError(null)
      const updated = await api.supersedeMeasurement(item.id, {
        calculationInputs: item.calculationInputs,
        name: item.name,
        geometryKind: item.geometryKind === 'route' ? 'line' : item.geometryKind,
        geometry: item.normalizedGeometry ?? item.rawGeometry,
        reason: 'Thay đổi màu nét',
        note: nextNote,
      })
      replaceFeature(item.id, { ...optimistic, measurement: updated })
      void props.onRefresh?.()
    } catch (reason: unknown) {
      setSelectedColor(initialColor)
      replaceFeature(item.id, props.feature)
      setError(reason instanceof Error ? reason.message : 'Không thể đổi màu')
    }
  }

  const handleChangeColor = (colorHex: string) => {
    if (colorHex === selectedColor) return
    setSelectedColor(colorHex)
    replaceFeature(item.id, {
      ...props.feature,
      measurement: {
        ...item,
        note: JSON.stringify({ ...(noteData ?? {}), color: colorHex }),
      },
    })
    if (colorTimer.current) clearTimeout(colorTimer.current)
    colorTimer.current = setTimeout(() => void commitColor(colorHex), 160)
  }

  const handleDelete = async () => {
    props.onRemoveFeature?.(item.id)
    props.onClose()
    try {
      await api.deleteMeasurement(item.id)
      void props.onRefresh?.()
    } catch (reason: unknown) {
      replaceFeature(item.id, props.feature)
      setError(reason instanceof Error ? reason.message : 'Không thể xóa phép đo')
    }
  }

  return (
    <article className="map-feature-card" aria-label="Thông tin đối tượng đã chọn">
      <button
        className="map-feature-card__close"
        aria-label="Đóng thẻ"
        onClick={() => props.onClose()}
        type="button"
      >
        ×
      </button>

      {isEditing ? (
        <form className="map-feature-card__edit-form" onSubmit={handleSaveDetails}>
          <label>
            Tên
            <input
              autoFocus
              disabled={isSubmitting}
              maxLength={300}
              onChange={(event) => setNameInput(event.target.value)}
              value={nameInput}
            />
          </label>
          <label>
            Khu vực
            <select
              disabled={isSubmitting}
              onChange={(event) => setZoneInput(event.target.value)}
              value={zoneInput}
            >
              <option value="">Chưa gán</option>
              {props.zones?.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Dịch vụ
            <select
              disabled={isSubmitting}
              onChange={(event) => setGroupInput(event.target.value)}
              value={groupInput}
            >
              {compatibleGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>
          <div className="map-feature-card__edit-actions">
            <button
              className="button button--primary map-feature-card__sm-btn"
              disabled={isSubmitting || !nameInput.trim()}
              type="submit"
            >
              {isSubmitting ? 'Đang lưu…' : 'Lưu'}
            </button>
            <button
              className="button button--quiet map-feature-card__sm-btn"
              disabled={isSubmitting}
              onClick={cancelEdit}
              type="button"
            >
              Hủy
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="map-feature-card__header-row">
            <div className="map-feature-card__title-group">
              <span className="map-feature-card__label">Tên:</span>
              <strong className="map-feature-card__title">{item.name}</strong>
              <button
                aria-label="Sửa tên, khu vực và dịch vụ"
                className="map-feature-card__rename-btn"
                onClick={() => setIsEditing(true)}
                title="Sửa thông tin"
                type="button"
              >
                <svg
                  fill="none"
                  height="13"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  width="13"
                >
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </button>
            </div>
          </div>
          {error && <div className="map-feature-card__error">{error}</div>}
          <div className="map-feature-card__info-grid">
            <div className="map-feature-card__item">
              <span className="map-feature-card__label">Số liệu:</span>
              <strong className="map-feature-card__val-highlight">
                {measurementBaseValue(item)}
              </strong>
            </div>
            <div className="map-feature-card__item">
              <span className="map-feature-card__label">Ngày lập:</span>
              <span className="map-feature-card__val">{createdDate(item.createdAt)}</span>
            </div>
            <div className="map-feature-card__item">
              <span className="map-feature-card__label">Loại dịch vụ:</span>
              <span className="map-feature-card__val">{props.feature.serviceGroupName}</span>
            </div>
            <div className="map-feature-card__item map-feature-card__color-row">
              <span className="map-feature-card__label">Màu nét:</span>
              <div
                className="map-feature-card__color-swatches"
                role="radiogroup"
                aria-label="Màu nét phép đo"
              >
                {COLOR_PALETTE.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    aria-label={color.name}
                    title={color.name}
                    aria-checked={selectedColor === color.value}
                    className={`map-feature-card__color-swatch ${selectedColor === color.value ? 'is-active' : ''}`}
                    style={{ backgroundColor: color.value }}
                    onClick={() => handleChangeColor(color.value)}
                  />
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {!isEditing && (
        <div className="map-feature-card__actions-row">
          {isConfirmingDelete ? (
            <div className="map-feature-card__confirm-delete">
              <span>Xác nhận xóa phép đo này?</span>
              <div className="map-feature-card__confirm-btns">
                <button
                  className="button button--quiet map-feature-card__sm-btn"
                  onClick={() => setIsConfirmingDelete(false)}
                  type="button"
                >
                  Hủy
                </button>
                <button
                  className="button button--danger map-feature-card__sm-btn"
                  onClick={() => void handleDelete()}
                  type="button"
                >
                  Xóa ngay
                </button>
              </div>
            </div>
          ) : (
            <>
              {item.status === 'confirmed' && item.geometryKind !== 'route' && props.onEdit && (
                <button className="map-feature-card__edit-btn" onClick={props.onEdit} type="button">
                  Sửa hình dạng
                </button>
              )}
              <button
                className="map-feature-card__delete-btn"
                onClick={() => setIsConfirmingDelete(true)}
                type="button"
              >
                Xóa
              </button>
            </>
          )}
        </div>
      )}
    </article>
  )
}
