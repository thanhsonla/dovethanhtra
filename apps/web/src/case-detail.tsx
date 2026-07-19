import type { InspectionCase, WorkItem, WorkType } from '@dove/contracts'
import type { FormEvent } from 'react'

import { api } from './api.js'

const statusLabel: Record<InspectionCase['status'], string> = {
  archived: 'Lưu trữ',
  draft: 'Nháp',
  in_progress: 'Đang thực hiện',
  locked: 'Đã khóa',
  review: 'Chờ rà soát',
}
const field = (values: FormData, name: string) => {
  const value = values.get(name)
  return typeof value === 'string' ? value : ''
}

export function CaseDetail(props: {
  item: InspectionCase | null
  onCreated(item: WorkItem): void
  onError(value: string): void
  onOpenMap(): void
  workItems: WorkItem[]
  workTypes: WorkType[]
}) {
  if (!props.item)
    return (
      <section className="panel detail-panel">
        <p className="empty">Chọn một hồ sơ để xem chi tiết.</p>
      </section>
    )
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const values = new FormData(form)
    try {
      const created = await api.createWorkItem(props.item!.id, {
        name: field(values, 'name'),
        workTypeId: field(values, 'workTypeId'),
      })
      form.reset()
      props.onCreated(created)
    } catch (reason) {
      props.onError(reason instanceof Error ? reason.message : 'Không thể thêm công tác.')
    }
  }
  return (
    <section className="panel detail-panel">
      <p className="section-kicker">Chi tiết hồ sơ</p>
      <h2>{props.item.name}</h2>
      <dl>
        <div>
          <dt>Kỳ kiểm tra</dt>
          <dd>
            {props.item.periodStart} – {props.item.periodEnd}
          </dd>
        </div>
        <div>
          <dt>Trạng thái</dt>
          <dd>{statusLabel[props.item.status]}</dd>
        </div>
      </dl>
      <h3>Công tác</h3>
      <ul className="work-list">
        {props.workItems.map((item) => (
          <li key={item.id}>
            <span>{item.name}</span>
            <small>
              {item.workTypeCode} · {item.unit}
            </small>
          </li>
        ))}
      </ul>
      {props.workItems.length > 0 && (
        <button className="button map-open-button" onClick={() => props.onOpenMap()}>
          Mở bản đồ hiện trường
        </button>
      )}
      {props.item.status !== 'locked' && (
        <form className="inline-form" onSubmit={(event) => void submit(event)}>
          <select name="workTypeId" aria-label="Loại công tác" required>
            <option value="">Chọn loại công tác</option>
            {props.workTypes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <input
            name="name"
            aria-label="Tên công tác"
            placeholder="Tên công tác trong hồ sơ"
            required
          />
          <button className="button" type="submit">
            Thêm
          </button>
        </form>
      )}
    </section>
  )
}
