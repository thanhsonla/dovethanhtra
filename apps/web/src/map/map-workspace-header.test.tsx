import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { createBasemapProvider } from './basemap-provider.js'
import { MapWorkspaceHeader } from './map-workspace-header.js'

describe('compact map workspace header', () => {
  it('uses abbreviated boundary text and an icon-only basemap selector', () => {
    const basemaps = createBasemapProvider({})
    const html = renderToString(
      <MapWorkspaceHeader
        basemapId={basemaps.defaultId}
        basemaps={basemaps}
        onBasemapChange={() => undefined}
        onShowCommunesChange={() => undefined}
        showCommunes
      />,
    )

    expect(html).toContain('RG &amp; tên P/X')
    expect(html).toContain('aria-label="Hiện ranh giới và tên phường xã"')
    expect(html).toContain('class="basemap-select__icon"')
    expect(html).toContain('aria-label="Bản đồ nền"')
    expect(html).not.toContain('Dữ liệu hiện trường')
    expect(html).not.toContain('map-header__title')
  })

  it('renders field mode toggle buttons for sun and night modes', () => {
    const basemaps = createBasemapProvider({})
    const html = renderToString(
      <MapWorkspaceHeader
        basemapId={basemaps.defaultId}
        basemaps={basemaps}
        fieldMode="sun"
        onBasemapChange={() => undefined}
        onFieldModeChange={() => undefined}
        onShowCommunesChange={() => undefined}
        showCommunes
      />,
    )

    expect(html).toContain('Chói nắng')
    expect(html).toContain('Đêm')
    expect(html).toContain('field-mode-toggle')
  })
})
