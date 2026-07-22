import type { WorkItem } from '@dove/contracts'
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
})
