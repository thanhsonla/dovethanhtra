import type { Measurement, MeasurementListResponse } from '@dove/contracts'
import { useState } from 'react'

import { measurementQuantity } from './measurement-summary.js'

const statusLabels: Record<Measurement['status'], string> = {
  confirmed: 'Đã xác nhận',
  deleted: 'Đã xóa',
  draft: 'Nháp',
  needs_attention: 'Cần xử lý',
  pending_validation: 'Chờ kiểm tra',
  superseded: 'Đã thay thế',
}

export function reviewableMeasurements(
  summary: MeasurementListResponse | undefined,
): Measurement[] {
  return (summary?.items ?? []).filter(
    (measurement) => measurement.status === 'draft' || measurement.status === 'needs_attention',
  )
}

function canQuickConfirm(measurement: Measurement): boolean {
  return measurement.status === 'draft' && measurement.warnings.length === 0
}

export function MeasurementReviewQueue(props: {
  inspectionLocked: boolean
  onConfirm(measurement: Measurement): Promise<void>
  onOpen(measurement: Measurement): void
  summary: MeasurementListResponse | undefined
}) {
  const [open, setOpen] = useState(false)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const items = reviewableMeasurements(props.summary)

  if (items.length === 0) return null

  const confirm = async (measurement: Measurement) => {
    setConfirmingId(measurement.id)
    try {
      await props.onConfirm(measurement)
    } finally {
      setConfirmingId(null)
    }
  }

  return (
    <section className="measurement-review-queue" aria-label="Rà soát phép đo">
      <button
        aria-expanded={open}
        className="measurement-review-queue__toggle"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <span>Cần rà soát</span>
        <strong>{items.length}</strong>
        <small>{open ? 'Thu gọn' : 'Mở danh sách'}</small>
      </button>
      {open && (
        <ul className="measurement-review-queue__list">
          {items.map((measurement) => {
            const hasWarnings = measurement.warnings.length > 0
            const quickConfirm = canQuickConfirm(measurement)
            const confirming = confirmingId === measurement.id
            return (
              <li key={measurement.id}>
                <div>
                  <strong>{measurement.name}</strong>
                  <span>
                    {statusLabels[measurement.status]} · {measurementQuantity(measurement)}
                  </span>
                  {hasWarnings && <small>{measurement.warnings.length} cảnh báo — cần xem</small>}
                </div>
                <div className="measurement-review-queue__actions">
                  <button onClick={() => props.onOpen(measurement)} type="button">
                    {hasWarnings ? 'Xem' : 'Mở'}
                  </button>
                  {quickConfirm && (
                    <button
                      className="measurement-review-queue__confirm"
                      disabled={props.inspectionLocked || confirming}
                      onClick={() => void confirm(measurement)}
                      type="button"
                    >
                      {confirming ? 'Đang xác nhận…' : 'Xác nhận'}
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
