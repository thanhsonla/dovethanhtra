import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { createBasemapProvider } from './basemap-provider.js'
import { MapLayerPanel } from './map-layer-panel.js'

describe('MapLayerPanel', () => {
  it('reuses the existing basemap, field mode and boundary controls', () => {
    const basemaps = createBasemapProvider({})
    const html = renderToString(
      <MapLayerPanel
        basemapId={basemaps.defaultId}
        basemaps={basemaps}
        fieldMode="sun"
        onBasemapChange={() => undefined}
        onFieldModeChange={() => undefined}
        onShowCommunesChange={() => undefined}
        showCommunes
      />,
    )

    expect(html).toContain('Chế độ thực địa')
    expect(html).toContain('Chói nắng')
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain('Hiện ranh giới và tên phường/xã')
    expect(html).toContain('aria-label="Bản đồ nền trong bảng Lớp"')
  })
})
