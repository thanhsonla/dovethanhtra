import type { AdminArea } from '@dove/contracts'
import { describe, expect, it } from 'vitest'

import { areaValidityLabel, effectiveAreas, isAreaEffective } from './admin-area-validity.js'

const area = (overrides: Partial<AdminArea> = {}): AdminArea => ({
  areaType: 'commune',
  code: 'TEST',
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Xã kiểm thử',
  source: 'fixture',
  sourceHash: null,
  sourceVersion: 'v1',
  validFrom: '2025-07-01',
  validTo: null,
  ...overrides,
})

describe('admin area validity', () => {
  it('keeps an area when its validity overlaps the whole or part of the case period', () => {
    expect(isAreaEffective(area(), '2026-07-01', '2026-07-31')).toBe(true)
    expect(isAreaEffective(area({ validTo: '2026-07-15' }), '2026-07-01', '2026-07-31')).toBe(true)
  })

  it('rejects missing, reversed and non-overlapping periods', () => {
    expect(isAreaEffective(area(), '', '2026-07-31')).toBe(false)
    expect(isAreaEffective(area(), '2026-08-01', '2026-07-31')).toBe(false)
    expect(isAreaEffective(area(), '2024-01-01', '2024-12-31')).toBe(false)
  })

  it('filters, sorts and labels selectable versions', () => {
    const areas = effectiveAreas(
      [
        area({ id: '00000000-0000-4000-8000-000000000002', name: 'Xã B' }),
        area({ id: '00000000-0000-4000-8000-000000000003', name: 'Xã A' }),
        area({ id: '00000000-0000-4000-8000-000000000004', validFrom: '2027-01-01' }),
      ],
      '2026-07-01',
      '2026-07-31',
    )
    expect(areas.map((item) => item.name)).toEqual(['Xã A', 'Xã B'])
    expect(areaValidityLabel(areas[0]!)).toBe('Xã A · hiệu lực 2025-07-01–nay')
  })
})
