import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { DrawingToolbar } from './drawing-toolbar.js'
import { MapDrawer } from './map-drawer.js'

describe('map-first shell', () => {
  it('exposes the compact measurement and panel controls to assistive technology', () => {
    const html = renderToString(
      <DrawingToolbar
        activePanel="data"
        canDelete={false}
        canFinish={false}
        canRedo={false}
        canUndo={false}
        mode="view"
        onCancel={() => undefined}
        onDelete={() => undefined}
        onFinish={() => undefined}
        onHistory={() => undefined}
        onOpenPanel={() => undefined}
        onStart={() => undefined}
      />,
    )

    expect(html).toContain('aria-label="Công cụ đo nhanh"')
    expect(html).toContain('>Điểm<')
    expect(html).toContain('>Chiều dài<')
    expect(html).toContain('>Diện tích<')
    expect(html).toContain('aria-label="Lùi điểm"')
    expect(html).toContain('aria-label="Khôi phục điểm"')
    expect(html).toContain('aria-label="Xóa phần đang chọn"')
    expect(html).toContain('aria-label="Kết thúc phép đo"')
    expect(html).toContain('aria-controls="map-data-drawer"')
    expect(html).toContain('aria-expanded="true"')
  })

  it('renders a labelled, non-modal and closable drawer', () => {
    const html = renderToString(
      <MapDrawer id="test-drawer" label="Dữ liệu hồ sơ" onClose={() => undefined}>
        Nội dung
      </MapDrawer>,
    )

    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="false"')
    expect(html).toContain('aria-label="Đóng dữ liệu hồ sơ"')
  })
})
