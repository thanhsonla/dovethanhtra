import type {
  ManagementZone,
  MapFeature,
  Measurement,
  ServiceGroup,
  WorkItem,
  WorkType,
} from '@dove/contracts'
import { useEffect, useMemo, useRef, useState } from 'react'

import { api } from '../api.js'
import { polygonPerimeterMeters } from './map-geometry.js'
import { measurementPartName } from './measurement-entry-defaults.js'
import { measurementBaseTotal, measurementBaseValue } from './measurement-summary.js'

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
  onAdd?: (() => void) | undefined
  onClose: () => void
  onEdit?: (() => void) | undefined
  onRefresh?: (() => Promise<void> | void) | undefined
  onRemoveFeature?: ((measurementId: string) => void) | undefined
  onReplaceFeature?: ((previousId: string, feature: MapFeature) => void) | undefined
  onWorkChanged?: ((item: WorkItem) => void) | undefined
  workItem?: WorkItem | null | undefined
  workMeasurements?: Measurement[] | undefined
  workTypes?: WorkType[] | undefined
  zones?: ManagementZone[] | undefined
}) {
  const item = props.feature.measurement
  const workMeasurements = (props.workMeasurements ?? [item])
    .filter(
      (measurement) =>
        measurement.workItemId === item.workItemId &&
        !measurement.deletedAt &&
        measurement.status !== 'superseded',
    )
    .toSorted((left, right) => left.createdAt.localeCompare(right.createdAt))
  const noteData = noteMetadata(item.note)
  const groupInitialColor = useMemo(() => {
    for (const m of workMeasurements) {
      const data = noteMetadata(m.note)
      if (typeof data?.color === 'string' && data.color) {
        return data.color
      }
    }
    return '#10b981'
  }, [workMeasurements])
  const [selectedColor, setSelectedColor] = useState(groupInitialColor)
  const [isEditing, setIsEditing] = useState(false)
  const [nameInput, setNameInput] = useState(item.name)
  const [zoneInput, setZoneInput] = useState(props.feature.managementZoneId ?? '')
  const [groupInput, setGroupInput] = useState(props.feature.serviceGroupId)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cardRef = useRef<HTMLElement | null>(null)
  const colorTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setSelectedColor(groupInitialColor)
  }, [groupInitialColor])

  useEffect(
    () => () => {
      if (colorTimer.current) clearTimeout(colorTimer.current)
    },
    [],
  )

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') props.onClose()
    }
    const closeOnOutside = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Node && !cardRef.current?.contains(target)) props.onClose()
    }
    document.addEventListener('keydown', closeOnEscape, true)
    document.addEventListener('pointerdown', closeOnOutside)
    return () => {
      document.removeEventListener('keydown', closeOnEscape, true)
      document.removeEventListener('pointerdown', closeOnOutside)
    }
  }, [props.onClose])

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
    try {
      setError(null)
      const results = await Promise.all(
        workMeasurements.map(async (m) => {
          const mData = noteMetadata(m.note)
          const nextNote = JSON.stringify({ ...(mData ?? {}), color: colorHex })
          return api.supersedeMeasurement(m.id, {
            calculationInputs: m.calculationInputs,
            name: m.name,
            geometryKind: m.geometryKind === 'route' ? 'line' : m.geometryKind,
            geometry: m.normalizedGeometry ?? m.rawGeometry,
            reason: 'Thay đổi màu nét nhóm đối tượng',
            note: nextNote,
          })
        }),
      )
      const updatedPrimary = results.find((m) => m.id === item.id) ?? results[0]
      if (updatedPrimary) {
        const nextNote = JSON.stringify({ ...(noteData ?? {}), color: colorHex })
        replaceFeature(item.id, {
          ...props.feature,
          measurement: { ...updatedPrimary, note: nextNote },
        })
      }
      void props.onRefresh?.()
    } catch (reason: unknown) {
      setSelectedColor(groupInitialColor)
      replaceFeature(item.id, props.feature)
      setError(reason instanceof Error ? reason.message : 'Không thể đổi màu nhóm đối tượng')
    }
  }

  const handleChangeColor = (colorHex: string) => {
    if (colorHex === selectedColor) return
    setSelectedColor(colorHex)
    const nextNote = JSON.stringify({ ...(noteData ?? {}), color: colorHex })
    replaceFeature(item.id, {
      ...props.feature,
      measurement: {
        ...item,
        note: nextNote,
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
    <article className="map-feature-card" aria-label="Thông tin đối tượng đã chọn" ref={cardRef}>
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
              <span className="map-feature-card__label">Tổng số liệu:</span>
              <strong className="map-feature-card__val-highlight">
                {measurementBaseTotal(workMeasurements)}
              </strong>
            </div>
            <div className="map-feature-card__parts" aria-label="Các lần đo">
              {workMeasurements.map((measurement, index) => {
                const perimeterM =
                  measurement.geometryKind === 'area'
                    ? polygonPerimeterMeters(
                        measurement.normalizedGeometry ?? measurement.rawGeometry,
                      )
                    : null

                return (
                  <div className="map-feature-card__part" key={measurement.id}>
                    <span>
                      {measurement.geometryKind === 'route'
                        ? `Lộ trình ${String(index + 1).padStart(2, '0')}`
                        : measurementPartName(measurement.geometryKind, index + 1)}
                    </span>
                    <strong>
                      {measurementBaseValue(measurement)}
                      {perimeterM != null && (
                        <small className="map-feature-card__perimeter-badge">
                          {' '}
                          (Chu vi:{' '}
                          {perimeterM.toLocaleString('vi-VN', {
                            maximumFractionDigits: 1,
                            minimumFractionDigits: 1,
                          })}{' '}
                          m)
                        </small>
                      )}
                    </strong>
                  </div>
                )
              })}
            </div>
            <div className="map-feature-card__item">
              <span className="map-feature-card__label">Ngày lập:</span>
              <span className="map-feature-card__val">{createdDate(item.createdAt)}</span>
            </div>
            <div className="map-feature-card__item">
              <span className="map-feature-card__label">Khu vực:</span>
              <span className="map-feature-card__val">
                {props.feature.managementZoneName ?? 'Chưa gán'}
              </span>
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
              {item.geometryKind !== 'route' && props.onAdd && (
                <button className="map-feature-card__add-btn" onClick={props.onAdd} type="button">
                  Thêm
                </button>
              )}
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
