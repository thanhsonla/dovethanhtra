import type { MeasurementListResponse, WorkItem, WorkType } from '@dove/contracts'
import { useState } from 'react'

import { nextWorkToVisit, workProgress } from './work-progress.js'

function description(item: ReturnType<typeof workProgress>[number]): string {
  if (!item.hasData) return 'Chưa có bộ phận đo'
  const parts = [`${item.confirmed} đã xác nhận`]
  if (item.review > 0) parts.push(`${item.review} cần xử lý`)
  return parts.join(' · ')
}

export function WorkProgressPanel(props: {
  onSelect(workItemId: string): void
  selectedWorkId: string
  summaries: Record<string, MeasurementListResponse>
  workItems: WorkItem[]
  workTypes: WorkType[]
}) {
  const [open, setOpen] = useState(false)
  const items = workProgress(props.workItems, props.workTypes, props.summaries)
  const withData = items.filter((item) => item.hasData).length
  const reviewCount = items.reduce((total, item) => total + item.review, 0)
  const next = nextWorkToVisit(items, props.selectedWorkId)
  const ordered = [...items].sort(
    (left, right) =>
      Number(right.review > 0) - Number(left.review > 0) ||
      Number(left.hasData) - Number(right.hasData) ||
      left.name.localeCompare(right.name, 'vi'),
  )

  if (items.length === 0) return null

  return (
    <section className="work-progress-panel" aria-label="Tiến độ hồ sơ">
      <button
        aria-expanded={open}
        className="work-progress-panel__toggle"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <span>Tiến độ hồ sơ</span>
        <strong>
          {withData}/{items.length} có dữ liệu
        </strong>
        {reviewCount > 0 && <small>{reviewCount} cần xử lý</small>}
      </button>
      {next && (
        <button
          className="work-progress-panel__next"
          onClick={() => props.onSelect(next.id)}
          type="button"
        >
          Đến việc cần làm: {next.name}
        </button>
      )}
      {open && (
        <ul className="work-progress-panel__list">
          {ordered.map((item) => (
            <li className={item.id === props.selectedWorkId ? 'is-selected' : ''} key={item.id}>
              <button onClick={() => props.onSelect(item.id)} type="button">
                <strong>{item.name}</strong>
                <span>{item.typeName}</span>
                <small>{description(item)}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
