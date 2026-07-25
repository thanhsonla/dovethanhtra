import type { MapFeature, Measurement } from '@dove/contracts'
import { useState } from 'react'

import { measurementPartName } from './measurement-entry-defaults.js'
import { measurementBaseTotal, measurementBaseValue } from './measurement-summary.js'

export type SidebarTab = 'line' | 'area' | 'point'

type MeasurementGroup = {
  id: string
  primary: Measurement
  children: Measurement[]
  measurements: Measurement[]
}

type ZoneGroup = {
  zoneName: string
  groups: MeasurementGroup[]
}

function groupsFor(measurements: Measurement[]): MeasurementGroup[] {
  const byWorkItem = new Map<string, Measurement[]>()

  for (const measurement of measurements) {
    const groupId = measurement.workItemId ?? measurement.id
    const items = byWorkItem.get(groupId) ?? []
    items.push(measurement)
    byWorkItem.set(groupId, items)
  }

  return [...byWorkItem.entries()].flatMap<MeasurementGroup>(([id, items]) => {
    const sorted = items.toSorted((left, right) => left.createdAt.localeCompare(right.createdAt))
    const [primary, ...children] = sorted
    if (!primary) return []

    return {
      id,
      primary,
      children,
      measurements: sorted,
    }
  })
}

function isInTab(group: MeasurementGroup, tab: SidebarTab): boolean {
  if (tab === 'line') {
    return group.primary.geometryKind === 'line' || group.primary.geometryKind === 'route'
  }
  return group.primary.geometryKind === tab
}

function componentName(measurement: Measurement, sequence: number): string {
  if (measurement.geometryKind === 'route') {
    return `Tuyến ${String(sequence).padStart(2, '0')}`
  }
  return measurementPartName(measurement.geometryKind, sequence)
}

export function MapFeatureSidebar(props: {
  loading?: boolean
  measurements: Measurement[]
  features?: MapFeature[]
  selectedId: string | null
  onSelect(measurement: Measurement): void
  onClose?(): void
}) {
  const [activeTab, setActiveTab] = useState<SidebarTab>('line')

  const activeMeasurements = props.measurements.filter(
    (item) => !item.deletedAt && item.status !== 'superseded',
  )
  const groups = groupsFor(activeMeasurements)
  const filtered = groups.filter((group) => isInTab(group, activeTab))
  const countFor = (kind: SidebarTab) => groups.filter((group) => isInTab(group, kind)).length

  // Build Map for fast feature lookup (managementZoneName)
  const featureMap = new Map<string, MapFeature>()
  if (props.features) {
    for (const f of props.features) {
      featureMap.set(f.measurement.id, f)
    }
  }

  function getZoneName(m: Measurement): string {
    const feat = featureMap.get(m.id)
    if (feat?.managementZoneName?.trim()) return feat.managementZoneName.trim()
    return 'Chưa phân khu vực'
  }

  // Group filtered groups by Zone
  const zoneMap = new Map<string, MeasurementGroup[]>()
  for (const group of filtered) {
    const zoneName = getZoneName(group.primary)
    const list = zoneMap.get(zoneName) ?? []
    list.push(group)
    zoneMap.set(zoneName, list)
  }

  // Sort zones alphabetically (A-Z)
  const sortedZones: ZoneGroup[] = [...zoneMap.entries()]
    .map(([zoneName, itemGroups]) => ({ zoneName, groups: itemGroups }))
    .sort((a, b) => a.zoneName.localeCompare(b.zoneName, 'vi'))

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
          <div className="map-feature-sidebar__zones">
            {sortedZones.map((zone) => {
              const isZoneSelected = zone.groups.some((group) =>
                group.measurements.some((m) => m.id === props.selectedId),
              )

              return (
                <details
                  key={zone.zoneName}
                  open={isZoneSelected ? true : undefined}
                  className="map-sidebar-zone-group"
                >
                  <summary className="map-sidebar-zone-summary">
                    <span>📍</span>
                    <strong>{zone.zoneName}</strong>
                    <span className="map-sidebar-zone-count">({zone.groups.length} đối tượng)</span>
                  </summary>
                <div className="map-sidebar-zone-content">
                  <ul className="map-feature-sidebar__list">
                    {zone.groups.map((group) => {
                      const isSelected = group.measurements.some(
                        (item) => item.id === props.selectedId,
                      )
                      const selectedChild = group.children.some(
                        (item) => item.id === props.selectedId,
                      )

                      return (
                        <li key={group.id} className="map-feature-sidebar__group">
                          <button
                            type="button"
                            className={`map-feature-sidebar__item ${isSelected ? 'is-selected' : ''}`}
                            onClick={() => props.onSelect(group.primary)}
                          >
                            <div className="map-feature-sidebar__item-header">
                              <strong className="map-feature-sidebar__item-name">
                                {group.primary.name}:
                              </strong>
                              <span className="map-feature-sidebar__item-val">
                                {measurementBaseTotal(group.measurements)}
                              </span>
                            </div>
                          </button>
                          {group.children.length > 0 ? (
                            <details
                              className="map-feature-sidebar__components"
                              open={selectedChild}
                            >
                              <summary>{group.children.length} phần đo bổ sung</summary>
                              <ul className="map-feature-sidebar__component-list">
                                {group.children.map((item, index) => (
                                  <li key={item.id}>
                                    <button
                                      type="button"
                                      className={`map-feature-sidebar__component ${
                                        props.selectedId === item.id ? 'is-selected' : ''
                                      }`}
                                      onClick={() => props.onSelect(item)}
                                    >
                                      <span>{componentName(item, index + 2)}: </span>
                                      <strong>{measurementBaseValue(item)}</strong>
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            </details>
                          ) : null}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </details>
            )
          })}
        </div>
        )}
      </div>
    </div>
  )
}
