import type { Measurement, WorkItem } from '@dove/contracts'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { MeasurementInspector } from './measurement-inspector.js'

const workItem: WorkItem = {
  caseId: '00000000-0000-4000-8000-000000000001',
  deletedAt: null,
  formulaSnapshot: { calculationSpec: { requiredInputs: ['frequency'] } },
  id: '00000000-0000-4000-8000-000000000002',
  managementZoneId: null,
  managementZoneName: 'Mộc Châu',
  measurementKind: 'line',
  name: 'Công tác thử',
  periodEnd: null,
  periodStart: null,
  serviceGroupId: '00000000-0000-4000-8000-000000000003',
  serviceGroupName: 'Vệ sinh môi trường',
  status: 'active',
  unit: 'm.lần',
  version: 1,
  warningThreshold: {},
  workTypeCode: 'TEST_LINE',
  workTypeId: '00000000-0000-4000-8000-000000000004',
}

const areaMeasurement: Measurement = {
  baseValue: 100,
  calculatedQuantity: 100,
  calculationInputs: {},
  calculationOutput: {},
  calculationRuleCode: 'RULE-AREA-1',
  calculationVersion: 1,
  caseId: '00000000-0000-4000-8000-000000000001',
  captureDraftId: null,
  code: 'M-AREA',
  confirmedAt: '2026-07-26T00:00:00.000Z',
  createdAt: '2026-07-26T00:00:00.000Z',
  deletedAt: null,
  geometryKind: 'area',
  gpsAccuracyM: null,
  id: '00000000-0000-4000-8000-000000000005',
  method: 'map_draw',
  name: 'Khu vực cắt cỏ',
  normalizedGeometry: null,
  note: null,
  rawGeometry: {
    coordinates: [
      [
        [104.65, 20.8],
        [104.66, 20.8],
        [104.66, 20.81],
        [104.65, 20.81],
        [104.65, 20.8],
      ],
    ],
    type: 'Polygon',
  },
  status: 'confirmed',
  supersedesId: null,
  unit: 'm²',
  updatedAt: '2026-07-26T00:00:00.000Z',
  validationStatus: 'valid',
  version: 1,
  warnings: [],
  workComponentId: null,
  workItemId: workItem.id,
}

describe('measurement inspector compact addition', () => {
  it('shows only the added value, name and one save action', () => {
    const html = renderToString(
      <MeasurementInspector
        compactAddition
        defaultName="Tuyến 02"
        draftGeometry={{
          coordinates: [
            [104.65, 20.8],
            [104.651, 20.8],
          ],
          type: 'LineString',
        }}
        draftReady
        editMode={false}
        initialCalculationInputs={{ frequency: 2 }}
        measurement={null}
        onCancel={() => undefined}
        onChanged={async () => undefined}
        onEdit={() => undefined}
        onError={() => undefined}
        onSaved={async () => undefined}
        selectedKind="line"
        selectedWork={workItem}
        subtractionTarget={null}
      />,
    )

    expect(html).toContain('Số liệu phần bổ sung')
    expect(html).toContain('Tên vùng đo bổ sung')
    expect(html).toContain('Tuyến 02')
    expect(html).toContain('>Lưu<')
    expect(html).not.toContain('Tần suất thực hiện')
    expect(html).not.toContain('Ghi chú và thông tin thêm')
    expect(html).not.toContain('Lưu và tiếp tục')
    expect(html).not.toContain('Lưu và xác nhận')
  })

  it('shows a compact subtraction summary and a single save action', () => {
    const html = renderToString(
      <MeasurementInspector
        compactAddition={false}
        defaultName=""
        draftGeometry={{
          coordinates: [
            [
              [104.653, 20.803],
              [104.657, 20.803],
              [104.657, 20.807],
              [104.653, 20.803],
            ],
          ],
          type: 'Polygon',
        }}
        draftReady
        editMode={false}
        initialCalculationInputs={{}}
        measurement={null}
        onCancel={() => undefined}
        onChanged={async () => undefined}
        onEdit={() => undefined}
        onError={() => undefined}
        onSaved={async () => undefined}
        selectedKind="area"
        selectedWork={{ ...workItem, measurementKind: 'area', unit: 'm²' }}
        subtractionTarget={areaMeasurement}
      />,
    )

    expect(html).toContain('Số liệu vùng bớt')
    expect(html).toContain('Lưu vùng bớt')
    expect(html).toContain('nằm hoàn toàn trong diện tích')
    expect(html).not.toContain('Tên vùng đo bổ sung')
    expect(html).not.toContain('Lưu và xác nhận')
  })
})
