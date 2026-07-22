import type {
  ManagementZone,
  MapFeature,
  MapFeatureConfirmedTotal,
  ServiceGroup,
  WorkItem,
} from '@dove/contracts'
import { useEffect, useState, type FormEvent } from 'react'

import type { MapFeatureFilters } from './use-map-features.js'
import { measurementBaseValue, measurementQuantity } from './measurement-summary.js'

export function MapFeatureFilterPanel(props: {
  confirmedTotals: MapFeatureConfirmedTotal[]
  filters: MapFeatureFilters
  groups: ServiceGroup[]
  items: MapFeature[]
  loading: boolean
  nextCursor: string | null
  onChange(filters: MapFeatureFilters): void
  onLoadMore(): void
  onSelect(id: string): void
  selectedId: string | null
  workItems: WorkItem[]
  zones: ManagementZone[]
}) {
  const categoryValue = props.filters.workItemId
    ? `work:${props.filters.workItemId}`
    : props.filters.serviceGroupId
      ? `group:${props.filters.serviceGroupId}`
      : props.filters.managementZoneId
        ? `zone:${props.filters.managementZoneId}`
        : ''
  const [draftName, setDraftName] = useState(props.filters.search)
  const [draftCategory, setDraftCategory] = useState(categoryValue)
  const hasPrimarySearch = Boolean(props.filters.search.trim() || categoryValue)

  useEffect(() => setDraftName(props.filters.search), [props.filters.search])
  useEffect(() => setDraftCategory(categoryValue), [categoryValue])

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const [kind, id = ''] = draftCategory.split(':')
    props.onChange({
      ...props.filters,
      componentId: '',
      geometryKind: '',
      managementZoneId: kind === 'zone' ? id : '',
      search: draftName.trim(),
      serviceGroupId: kind === 'group' ? id : '',
      status: '',
      workItemId: kind === 'work' ? id : '',
    })
  }

  return (
    <section className="map-feature-filter">
      <form className="map-search-primary" onSubmit={submit}>
        <label>
          Tìm theo tên
          <input
            id="map-search-name"
            maxLength={120}
            onChange={(event) => setDraftName(event.target.value)}
            placeholder="Tên đối tượng, công tác, mục con…"
            type="search"
            value={draftName}
          />
        </label>
        <label>
          Danh mục
          <select
            id="map-search-category"
            onChange={(event) => setDraftCategory(event.target.value)}
            value={draftCategory}
          >
            <option value="">Tất cả danh mục</option>
            <optgroup label="Khu vực">
              {props.zones.map((item) => (
                <option key={item.id} value={`zone:${item.id}`}>
                  {item.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Lĩnh vực">
              {props.groups.map((item) => (
                <option key={item.id} value={`group:${item.id}`}>
                  {item.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Công tác">
              {props.workItems.map((item) => (
                <option key={item.id} value={`work:${item.id}`}>
                  {item.name}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        <div className="map-search-actions">
          <button className="map-search-submit" disabled={props.loading} type="submit">
            Tìm kiếm
          </button>
          <button
            className="map-filter-reset"
            type="button"
            onClick={() => {
              setDraftName('')
              setDraftCategory('')
              props.onChange({
                componentId: '',
                geometryKind: '',
                managementZoneId: '',
                search: '',
                serviceGroupId: '',
                status: '',
                workItemId: '',
              })
            }}
          >
            Xóa
          </button>
        </div>
      </form>
      <div className="map-filter-totals" aria-label="Tổng đã xác nhận">
        <span>Tổng máy chủ · chỉ dữ liệu đã xác nhận</span>
        <strong>
          {props.confirmedTotals.length
            ? props.confirmedTotals
                .map((item) => `${item.total.toLocaleString('vi-VN')} ${item.unit}`)
                .join(' · ')
            : '—'}
        </strong>
      </div>
      <p className="map-filter-count">
        {props.loading
          ? 'Đang tìm…'
          : hasPrimarySearch
            ? `${props.items.length} kết quả tìm kiếm`
            : `${props.items.length} đối tượng trong vùng nhìn`}
      </p>
      <ul className="map-feature-list">
        {props.items.map((item) => (
          <li key={item.measurement.id}>
            <button
              className={props.selectedId === item.measurement.id ? 'is-active' : undefined}
              onClick={() => props.onSelect(item.measurement.id)}
              type="button"
            >
              <strong>{item.measurement.name}</strong>
              <span>
                {item.workItemName}
                {item.workComponentName ? ` · ${item.workComponentName}` : ''}
              </span>
              <small>
                {measurementBaseValue(item.measurement)} · {measurementQuantity(item.measurement)}
              </small>
            </button>
          </li>
        ))}
      </ul>
      {props.nextCursor && (
        <button
          className="map-filter-more"
          disabled={props.loading}
          onClick={() => props.onLoadMore()}
          type="button"
        >
          Nạp thêm trong vùng nhìn
        </button>
      )}
    </section>
  )
}
