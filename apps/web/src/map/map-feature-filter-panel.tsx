import type {
  ManagementZone,
  MapFeature,
  MapFeatureConfirmedTotal,
  ServiceGroup,
  WorkComponent,
  WorkItem,
} from '@dove/contracts'

import type { MapFeatureFilters } from './use-map-features.js'
import { measurementBaseValue, measurementQuantity } from './measurement-summary.js'

const statuses = [
  ['', 'Mọi trạng thái'],
  ['draft', 'Nháp'],
  ['pending_validation', 'Chờ kiểm tra'],
  ['needs_attention', 'Cần chú ý'],
  ['confirmed', 'Đã xác nhận'],
] as const
const kinds = [
  ['', 'Mọi công cụ'],
  ['point', 'Điểm'],
  ['line', 'Chiều dài'],
  ['area', 'Diện tích'],
] as const

export function MapFeatureFilterPanel(props: {
  components: WorkComponent[]
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
  const set = (key: keyof MapFeatureFilters, value: string) => {
    const next = { ...props.filters, [key]: value }
    if (key === 'managementZoneId') Object.assign(next, { componentId: '', workItemId: '' })
    if (key === 'serviceGroupId') Object.assign(next, { componentId: '', workItemId: '' })
    if (key === 'workItemId') next.componentId = ''
    props.onChange(next)
  }
  const works = props.workItems.filter(
    (item) =>
      (!props.filters.managementZoneId ||
        item.managementZoneId === props.filters.managementZoneId) &&
      (!props.filters.serviceGroupId || item.serviceGroupId === props.filters.serviceGroupId),
  )

  return (
    <section className="map-feature-filter">
      <div className="map-filter-grid">
        <label>
          Khu vực
          <select
            value={props.filters.managementZoneId}
            onChange={(event) => set('managementZoneId', event.target.value)}
          >
            <option value="">Tất cả khu vực</option>
            {props.zones.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Lĩnh vực
          <select
            value={props.filters.serviceGroupId}
            onChange={(event) => set('serviceGroupId', event.target.value)}
          >
            <option value="">Tất cả lĩnh vực</option>
            {props.groups.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Công tác
          <select
            value={props.filters.workItemId}
            onChange={(event) => set('workItemId', event.target.value)}
          >
            <option value="">Tất cả công tác</option>
            {works.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Mục con
          <select
            disabled={!props.filters.workItemId}
            value={props.filters.componentId}
            onChange={(event) => set('componentId', event.target.value)}
          >
            <option value="">Tất cả mục con</option>
            {props.components.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Công cụ
          <select
            value={props.filters.geometryKind}
            onChange={(event) => set('geometryKind', event.target.value)}
          >
            {kinds.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Trạng thái
          <select
            value={props.filters.status}
            onChange={(event) => set('status', event.target.value)}
          >
            {statuses.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button
        className="map-filter-reset"
        type="button"
        onClick={() =>
          props.onChange({
            componentId: '',
            geometryKind: '',
            managementZoneId: '',
            serviceGroupId: '',
            status: '',
            workItemId: '',
          })
        }
      >
        Xóa bộ lọc
      </button>
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
        {props.loading ? 'Đang tải…' : `${props.items.length} đối tượng trong vùng nhìn`}
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
