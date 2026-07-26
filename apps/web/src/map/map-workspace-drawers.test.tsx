import { isValidElement, type ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'

import type { MapDrawer } from './map-drawer.js'
import { MapWorkspaceDrawers } from './map-workspace-drawers.js'

describe('MapWorkspaceDrawers', () => {
  it('discards the unsaved geometry when the capture drawer is closed', () => {
    const cancelCapture = vi.fn()
    const closeOnly = vi.fn()
    const element = MapWorkspaceDrawers({
      activePanel: 'capture',
      capture: {
        geometry: {
          coordinates: [
            [104.65, 20.8],
            [104.651, 20.8],
          ],
          type: 'LineString',
        },
        kind: 'line',
        onCancel: cancelCapture,
        onQuickSave: () => undefined,
        saving: false,
        zones: [],
      },
      classification: null,
      data: {} as never,
      details: {} as never,
      filters: {} as never,
      layers: {} as never,
      onClose: closeOnly,
      sidebar: null,
    })

    expect(isValidElement<ComponentProps<typeof MapDrawer>>(element)).toBe(true)
    if (!isValidElement<ComponentProps<typeof MapDrawer>>(element)) return

    element.props.onClose()

    expect(cancelCapture).toHaveBeenCalledOnce()
    expect(closeOnly).not.toHaveBeenCalled()
  })
})
