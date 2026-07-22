import type { MeasurementKind, ServiceGroup, UserRole, WorkType } from '@dove/contracts'
import { type CSSProperties, type FormEvent, useMemo, useState } from 'react'

import { api } from './api.js'

const measurementKinds: Array<{ label: string; value: MeasurementKind }> = [
  { label: 'Đếm', value: 'count' },
  { label: 'Điểm', value: 'point' },
  { label: 'Tuyến', value: 'line' },
  { label: 'Diện tích', value: 'area' },
  { label: 'Lộ trình', value: 'route' },
  { label: 'Tổng hợp', value: 'composite' },
]

function field(values: FormData, name: string): string {
  const value = values.get(name)
  return typeof value === 'string' ? value : ''
}

export function CatalogPanel(props: {
  groups: ServiceGroup[]
  onCreated(item: WorkType): void
  onError(value: string): void
  role: UserRole
  workTypes: WorkType[]
}) {
  const [creating, setCreating] = useState(false)
  const counts = useMemo(
    () =>
      new Map(
        props.groups.map((group) => [
          group.id,
          props.workTypes.filter((item) => item.serviceGroupId === group.id).length,
        ]),
      ),
    [props.groups, props.workTypes],
  )
  const canManage = props.role === 'owner' || props.role === 'catalog_admin'

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const values = new FormData(form)
    try {
      const created = await api.createWorkType({
        baseUnit: field(values, 'baseUnit'),
        calculationSpec: {
          expression: field(values, 'expression'),
          ruleCode: field(values, 'ruleCode'),
          version: 1,
        },
        calculationVersion: 1,
        code: field(values, 'code'),
        measurementKind: field(values, 'measurementKind') as MeasurementKind,
        name: field(values, 'name'),
        serviceGroupId: field(values, 'serviceGroupId'),
      })
      form.reset()
      setCreating(false)
      props.onCreated(created)
    } catch (reason) {
      props.onError(reason instanceof Error ? reason.message : 'Không thể tạo loại công tác.')
    }
  }

  return (
    <section className="panel catalog-panel">
      <div className="panel-heading">
        <div>
          <p className="section-kicker">Danh mục có phiên bản</p>
          <h2>Nhóm dịch vụ</h2>
        </div>
        {canManage && (
          <button className="button button--quiet" onClick={() => setCreating((value) => !value)}>
            {creating ? 'Đóng' : 'Thêm loại'}
          </button>
        )}
      </div>
      <ul>
        {props.groups.map((group) => (
          <li key={group.id}>
            <span
              className="catalog-dot"
              style={
                {
                  background: group.color ?? '#63736c',
                  '--dot-color': group.color ?? '#63736c',
                } as CSSProperties & { '--dot-color': string }
              }
            />
            <span>{group.name}</span>
            <strong>{counts.get(group.id) ?? 0}</strong>
          </li>
        ))}
      </ul>
      {creating && (
        <form className="inline-form catalog-form" onSubmit={(event) => void submit(event)}>
          <select aria-label="Nhóm dịch vụ" name="serviceGroupId" required>
            <option value="">Chọn nhóm dịch vụ</option>
            {props.groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
          <input
            aria-label="Mã loại công tác"
            name="code"
            pattern="[A-Z0-9_]+"
            placeholder="MÃ_CÔNG_TÁC"
            required
          />
          <input
            aria-label="Tên loại công tác"
            name="name"
            placeholder="Tên loại công tác"
            required
          />
          <select aria-label="Kiểu đo" name="measurementKind" required>
            {measurementKinds.map((kind) => (
              <option key={kind.value} value={kind.value}>
                {kind.label}
              </option>
            ))}
          </select>
          <input aria-label="Đơn vị cơ sở" name="baseUnit" placeholder="m, m2, điểm…" required />
          <input aria-label="Mã quy tắc" name="ruleCode" placeholder="RULE-CUSTOM-1" required />
          <input
            aria-label="Biểu thức"
            name="expression"
            placeholder="Biểu thức cấu hình"
            required
          />
          <button className="button" type="submit">
            Lưu loại công tác
          </button>
        </form>
      )}
    </section>
  )
}
