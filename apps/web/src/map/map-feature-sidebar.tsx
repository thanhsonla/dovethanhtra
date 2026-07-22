import type { Measurement } from '@dove/contracts'
import { useState } from 'react'

export type SidebarTab = 'line' | 'area' | 'point'

export function MapFeatureSidebar(props: {
  loading?: boolean
  measurements: Measurement[]
  selectedId: string | null
  onSelect(measurement: Measurement): void
  onClose?(): void
}) {
  const [activeTab, setActiveTab] = useState<SidebarTab>('line')

  const activeMeasurements = props.measurements.filter((item) => !item.deletedAt)

  const filtered = activeMeasurements.filter((item) => {
    if (activeTab === 'line') return item.geometryKind === 'line' || item.geometryKind === 'route'
    if (activeTab === 'area') return item.geometryKind === 'area'
    if (activeTab === 'point') return item.geometryKind === 'point'
    return true
  })

  const countFor = (kind: SidebarTab) =>
    activeMeasurements.filter((item) =>
      kind === 'line'
        ? item.geometryKind === 'line' || item.geometryKind === 'route'
        : item.geometryKind === kind,
    ).length

  return (
    <div className="map-feature-sidebar">
      <div className="map-feature-sidebar__tabs" role="tablist">
        <button
          type="button"
          className={`map-sidebar-tab ${activeTab === 'line' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('line')}
          role="tab"
          aria-selected={activeTab === 'line'}
          title="Chiều dài"
          aria-label="Chiều dài"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
          >
            <path d="M3 21L21 3" />
            <circle cx="3" cy="21" r="2.5" fill="currentColor" />
            <circle cx="21" cy="3" r="2.5" fill="currentColor" />
          </svg>
          <span>({countFor('line')})</span>
        </button>
        <button
          type="button"
          className={`map-sidebar-tab ${activeTab === 'area' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('area')}
          role="tab"
          aria-selected={activeTab === 'area'}
          title="Diện tích"
          aria-label="Diện tích"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
          >
            <path d="M3 3h18v18H3z" strokeDasharray="3 3" />
            <path d="M3 3l18 18" />
          </svg>
          <span>({countFor('area')})</span>
        </button>
        <button
          type="button"
          className={`map-sidebar-tab ${activeTab === 'point' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('point')}
          role="tab"
          aria-selected={activeTab === 'point'}
          title="Điểm"
          aria-label="Điểm"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
          >
            <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z" />
            <circle cx="12" cy="10" r="2.5" fill="currentColor" />
          </svg>
          <span>({countFor('point')})</span>
        </button>
      </div>

      <div className="map-feature-sidebar__content">
        {props.loading && activeMeasurements.length === 0 ? (
          <div className="map-feature-sidebar__empty">Đang tải dữ liệu…</div>
        ) : filtered.length === 0 ? (
          <div className="map-feature-sidebar__empty">
            Chưa có dữ liệu{' '}
            {activeTab === 'line' ? 'chiều dài' : activeTab === 'area' ? 'diện tích' : 'điểm'}.
          </div>
        ) : (
          <ul className="map-feature-sidebar__list">
            {filtered.map((item) => {
              const unit =
                item.geometryKind === 'area' ? 'm²' : item.geometryKind === 'point' ? 'điểm' : 'm'
              const formattedVal = item.baseValue
                ? `${item.baseValue.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${unit}`
                : item.unit
                  ? `0.00 ${item.unit}`
                  : `0.00 ${unit}`
              const isSelected = props.selectedId === item.id

              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`map-feature-sidebar__item ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => props.onSelect(item)}
                  >
                    <div className="map-feature-sidebar__item-header">
                      <strong className="map-feature-sidebar__item-name">{item.name}</strong>
                      <span className="map-feature-sidebar__item-val">{formattedVal}</span>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
