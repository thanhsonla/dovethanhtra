import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { CaptureDraftPanel } from './capture-draft-panel.js'

describe('CaptureDraftPanel', () => {
  it('shows the compact one-step save form without draft terminology', () => {
    const html = renderToString(
      <CaptureDraftPanel
        geometry={{
          coordinates: [
            [104.65, 20.8],
            [104.651, 20.8],
          ],
          type: 'LineString',
        }}
        kind="line"
        onCancel={() => undefined}
        onQuickSave={() => undefined}
        saving={false}
        zones={[
          {
            active: true,
            code: 'MOC_CHAU',
            createdAt: '2026-07-22T00:00:00.000Z',
            deletedAt: null,
            displayOrder: 1,
            id: '00000000-0000-4000-8000-000000000001',
            name: 'Mộc Châu',
            systemSeed: true,
            updatedAt: '2026-07-22T00:00:00.000Z',
            version: 1,
          },
        ]}
      />,
    )

    expect(html).toContain('Tên công tác')
    expect(html).toContain('Khu vực')
    expect(html).toMatch(/\d+\.\d{2}m/)
    expect(html).toContain('>Hủy<')
    expect(html).toContain('>Lưu<')
    expect(html).not.toContain('Lưu nháp')
    expect(html).not.toContain('Lưu &amp; phân loại')
  })
})
