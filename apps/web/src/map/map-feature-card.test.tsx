import type { MapFeature, Measurement } from '@dove/contracts'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { MapFeatureCard } from './map-feature-card.js'

function feature(input: Partial<Measurement> = {}): MapFeature {
  const measurement: Measurement = {
    baseValue: 120.5,
    calculatedQuantity: 120.5,
    calculationInputs: {},
    calculationOutput: {},
    calculationRuleCode: 'RULE-LENGTH-1',
    calculationVersion: 1,
    caseId: '00000000-0000-4000-8000-000000000001',
    captureDraftId: null,
    code: 'MEAS-1',
    confirmedAt: '2026-07-22T00:00:00.000Z',
    createdAt: '2026-07-22T00:00:00.000Z',
    deletedAt: null,
    geometryKind: 'line',
    gpsAccuracyM: null,
    id: '00000000-0000-4000-8000-000000000002',
    method: 'map_draw',
    name: 'Tuyến kiểm tra',
    normalizedGeometry: null,
    note: null,
    rawGeometry: {
      coordinates: [
        [104.65, 20.8],
        [104.651, 20.8],
      ],
      type: 'LineString',
    },
    status: 'confirmed',
    supersedesId: null,
    unit: 'm',
    updatedAt: '2026-07-22T00:00:00.000Z',
    validationStatus: 'valid',
    version: 1,
    warnings: [],
    workComponentId: null,
    workItemId: '00000000-0000-4000-8000-000000000003',
    ...input,
  }
  return {
    managementZoneId: null,
    managementZoneName: 'Mộc Châu',
    measurement,
    serviceGroupId: '00000000-0000-4000-8000-000000000004',
    serviceGroupName: 'Vệ sinh môi trường',
    workComponentName: null,
    workItemName: 'Quét đường',
  }
}

describe('map feature card', () => {
  it('shows the creation date, management zone and add action without calling it an address', () => {
    const primary = feature()
    const addition = feature({
      baseValue: 29.5,
      id: '00000000-0000-4000-8000-000000000005',
      name: 'Đoạn bổ sung 01',
    })
    const html = renderToString(
      <MapFeatureCard
        feature={primary}
        onAdd={() => undefined}
        onClose={() => undefined}
        onEdit={() => undefined}
        workMeasurements={[primary.measurement, addition.measurement]}
      />,
    )

    expect(html).toContain('Sửa hình dạng')
    expect(html).toContain('Ngày lập:')
    expect(html).toContain('22/07/2026')
    expect(html).toContain('Khu vực:')
    expect(html).toContain('Mộc Châu')
    expect(html).toContain('Tổng số liệu:')
    expect(html).toContain('150,00 m')
    expect(html).toContain('Tuyến 01')
    expect(html).toContain('120,50 m')
    expect(html).toContain('Tuyến 02')
    expect(html).toContain('29,50 m')
    expect(html).toContain('>Thêm<')
    expect(html).toContain('>Xóa<')
    expect(html).toContain('Sửa tên, khu vực và dịch vụ')
    expect(html).not.toContain('Địa chỉ:')
    expect(html).not.toContain('>Thông tin<')
  })

  it('does not crash when a business note starts like malformed JSON', () => {
    expect(() =>
      renderToString(
        <MapFeatureCard
          feature={feature({ note: '{ghi chú hiện trường' })}
          onClose={() => undefined}
        />,
      ),
    ).not.toThrow()
  })
})
