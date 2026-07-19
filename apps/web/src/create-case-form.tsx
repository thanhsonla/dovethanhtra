import type { AdminArea, InspectionCase, WorkItem } from '@dove/contracts'
import { type FormEvent, useState } from 'react'

import { api } from './api.js'

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'Có lỗi chưa xác định.'
}

function field(values: FormData, name: string): string {
  const value = values.get(name)
  return typeof value === 'string' ? value : ''
}

export function CreateCaseForm(props: {
  areas: AdminArea[]
  cases: InspectionCase[]
  onCreated(item: InspectionCase): Promise<void>
  onError(value: string): void
}) {
  const [sourceCaseId, setSourceCaseId] = useState('')
  const [sourceWorkItems, setSourceWorkItems] = useState<WorkItem[]>([])
  const [selectedWorkItemIds, setSelectedWorkItemIds] = useState<string[]>([])

  const changeSource = async (caseId: string) => {
    setSourceCaseId(caseId)
    setSourceWorkItems([])
    setSelectedWorkItemIds([])
    if (!caseId) return
    try {
      const items = await api.listWorkItems(caseId)
      setSourceWorkItems(items)
      setSelectedWorkItemIds(items.map((item) => item.id))
    } catch (reason) {
      props.onError(message(reason))
    }
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const values = new FormData(form)
    try {
      const created = await api.createCase({
        adminAreaId: field(values, 'adminAreaId'),
        caseCode: field(values, 'caseCode'),
        name: field(values, 'name'),
        periodEnd: field(values, 'periodEnd'),
        periodStart: field(values, 'periodStart'),
        ...(sourceCaseId && selectedWorkItemIds.length > 0
          ? { copyStructure: { sourceCaseId, workItemIds: selectedWorkItemIds } }
          : {}),
      })
      form.reset()
      setSourceCaseId('')
      setSourceWorkItems([])
      setSelectedWorkItemIds([])
      await props.onCreated(created)
    } catch (reason) {
      props.onError(message(reason))
    }
  }

  return (
    <form className="create-form" onSubmit={(event) => void submit(event)}>
      <label>
        Mã hồ sơ
        <input name="caseCode" required pattern={'[A-Za-z0-9._/\\u002D]+'} />
      </label>
      <label className="wide">
        Tên hồ sơ
        <input name="name" required />
      </label>
      <label>
        Địa bàn
        <select name="adminAreaId" required>
          <option value="">Chọn địa bàn</option>
          {props.areas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Từ ngày
        <input name="periodStart" type="date" required />
      </label>
      <label>
        Đến ngày
        <input name="periodEnd" type="date" required />
      </label>
      <label className="wide">
        Sao chép cấu trúc từ hồ sơ (không bắt buộc)
        <select value={sourceCaseId} onChange={(event) => void changeSource(event.target.value)}>
          <option value="">Không dùng hồ sơ mẫu</option>
          {props.cases.map((item) => (
            <option key={item.id} value={item.id}>
              {item.caseCode} · {item.name}
            </option>
          ))}
        </select>
      </label>
      {sourceCaseId && (
        <fieldset className="copy-structure wide">
          <legend>Chọn công tác cần sao chép</legend>
          {sourceWorkItems.length === 0 ? (
            <p className="empty">Hồ sơ mẫu không có công tác.</p>
          ) : (
            sourceWorkItems.map((item) => (
              <label className="copy-structure__item" key={item.id}>
                <input
                  checked={selectedWorkItemIds.includes(item.id)}
                  onChange={(event) =>
                    setSelectedWorkItemIds((current) =>
                      event.target.checked
                        ? [...current, item.id]
                        : current.filter((id) => id !== item.id),
                    )
                  }
                  type="checkbox"
                />
                <span>
                  {item.name} <small>({item.workTypeCode})</small>
                </span>
              </label>
            ))
          )}
          <small>
            Chỉ sao chép loại công tác, tên, đơn vị, snapshot công thức và ngưỡng cảnh báo; không
            sao chép kỳ, phép đo, tuyến, ảnh hay kết quả đối chiếu.
          </small>
        </fieldset>
      )}
      <button className="button" type="submit">
        Lưu hồ sơ
      </button>
    </form>
  )
}
