import { describe, expect, it } from 'vitest'

import { classificationPayload, compatibleWorkItems } from './capture-classification-options.js'

describe('capture classification options', () => {
  it('filters existing work by zone, service and geometry kind', () => {
    const base = {
      caseId: 'case',
      deletedAt: null,
      formulaSnapshot: {},
      managementZoneId: 'zone-1',
      managementZoneName: 'Khu vực 1',
      measurementKind: 'line' as const,
      name: 'Đường A',
      periodEnd: null,
      periodStart: null,
      serviceGroupId: 'service-1',
      serviceGroupName: 'Chiếu sáng',
      status: 'active' as const,
      unit: 'm',
      version: 1,
      warningThreshold: {},
      workTypeCode: 'LINE',
      workTypeId: 'type',
    }
    const items = [
      { ...base, id: 'match' },
      { ...base, id: 'other-zone', managementZoneId: 'zone-2' },
      { ...base, id: 'other-kind', measurementKind: 'area' as const },
    ]
    expect(
      compatibleWorkItems(items, 'zone-1', 'service-1', 'line').map((item) => item.id),
    ).toEqual(['match'])
  })

  it('builds an atomic create-work and create-component request', () => {
    expect(
      classificationPayload({
        componentId: 'new',
        componentName: ' Đường Trần Đăng Ninh ',
        measurementName: ' Đoạn 01 ',
        note: '',
        workItemId: 'new',
        workItemName: ' Chiều dài đường ',
        workTypeId: 'type-1',
        zoneId: 'zone-1',
      }),
    ).toEqual({
      createWorkComponent: { name: 'Đường Trần Đăng Ninh' },
      createWorkItem: {
        managementZoneId: 'zone-1',
        name: 'Chiều dài đường',
        workTypeId: 'type-1',
      },
      measurementName: 'Đoạn 01',
      note: null,
    })
  })
})
