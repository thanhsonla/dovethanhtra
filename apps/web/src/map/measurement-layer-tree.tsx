import type { MeasurementListResponse, ServiceGroup, WorkItem, WorkType } from '@dove/contracts'

const statusLabels: Record<string, string> = {
  confirmed: 'Đã xác nhận',
  draft: 'Nháp',
  needs_attention: 'Cần chú ý',
  pending_validation: 'Chờ kiểm tra',
  superseded: 'Đã thay thế',
}

export function MeasurementLayerTree(props: {
  groups: ServiceGroup[]
  hidden: Set<string>
  measurable: WorkItem[]
  onLoadMore(workItemId: string, cursor: string): void
  onSelectMeasurement(id: string): void
  onSelectWork(item: WorkItem): void
  onToggleWork(id: string): void
  selectedId: string | null
  selectedWorkId: string
  summaries: Record<string, MeasurementListResponse>
  workTypes: WorkType[]
}) {
  return (
    <aside className="layer-tree">
      <p className="section-kicker">Cây lớp dữ liệu</p>
      <h2>Công tác và phép đo</h2>
      {props.groups.map((group) => {
        const groupTypeIds = new Set(
          props.workTypes.filter((type) => type.serviceGroupId === group.id).map((type) => type.id),
        )
        const work = props.measurable.filter((item) => groupTypeIds.has(item.workTypeId))
        if (!work.length) return null
        return (
          <div className="layer-group" key={group.id}>
            <h3>
              <span className="catalog-dot" style={{ background: group.color ?? '#63736c' }} />
              {group.name}
            </h3>
            {work.map((item) => (
              <div className="layer-work" key={item.id}>
                <div className="layer-work__row">
                  <input
                    aria-label={`Hiển thị ${item.name}`}
                    type="checkbox"
                    checked={!props.hidden.has(item.id)}
                    onChange={() => props.onToggleWork(item.id)}
                  />
                  <button
                    className={
                      props.selectedWorkId === item.id
                        ? 'layer-button layer-button--active'
                        : 'layer-button'
                    }
                    onClick={() => props.onSelectWork(item)}
                  >
                    {item.name}
                  </button>
                </div>
                <ul>
                  {(props.summaries[item.id]?.items ?? []).map((measurement) => (
                    <li key={measurement.id}>
                      <button
                        className={
                          props.selectedId === measurement.id
                            ? 'measurement-link measurement-link--active'
                            : 'measurement-link'
                        }
                        onClick={() => props.onSelectMeasurement(measurement.id)}
                      >
                        <span>{measurement.name}</span>
                        <small>
                          v{measurement.version} ·{' '}
                          {statusLabels[measurement.status] ?? measurement.status}
                        </small>
                      </button>
                    </li>
                  ))}
                </ul>
                {props.summaries[item.id]?.nextCursor && (
                  <button
                    className="layer-load-more"
                    onClick={() => props.onLoadMore(item.id, props.summaries[item.id]!.nextCursor!)}
                  >
                    Nạp thêm
                  </button>
                )}
              </div>
            ))}
          </div>
        )
      })}
    </aside>
  )
}
