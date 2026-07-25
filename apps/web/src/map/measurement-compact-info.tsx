import type { Measurement } from '@dove/contracts'
import { polygonPerimeterMeters } from './map-geometry.js'
import { sanitizeUnit } from './measurement-summary.js'

export function MeasurementCompactInfo(props: { measurement: Measurement }) {
  const measurement = props.measurement
  const defaultUnit =
    measurement.geometryKind === 'area'
      ? 'm²'
      : measurement.geometryKind === 'line' || measurement.geometryKind === 'route'
        ? 'm'
        : 'điểm'
  const cleanUnit = sanitizeUnit(measurement.unit) || defaultUnit
  const value = (measurement.baseValue ?? 0).toLocaleString('vi-VN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })
  const createdAt = new Date(measurement.createdAt).toLocaleString('vi-VN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  const perimeterM =
    measurement.geometryKind === 'area'
      ? polygonPerimeterMeters(measurement.normalizedGeometry ?? measurement.rawGeometry)
      : null

  return (
    <dl className="measurement-compact-info">
      <div>
        <dt>Tên</dt>
        <dd>{measurement.name}</dd>
      </div>
      <div>
        <dt>Thời gian lập</dt>
        <dd>{createdAt}</dd>
      </div>
      <div>
        <dt>Số liệu</dt>
        <dd className="measurement-compact-info__value">
          {value} {cleanUnit}
        </dd>
      </div>
      {perimeterM != null && (
        <div>
          <dt>Chu vi</dt>
          <dd className="measurement-compact-info__value">
            {perimeterM.toLocaleString('vi-VN', {
              maximumFractionDigits: 1,
              minimumFractionDigits: 1,
            })}{' '}
            m
          </dd>
        </div>
      )}
    </dl>
  )
}
