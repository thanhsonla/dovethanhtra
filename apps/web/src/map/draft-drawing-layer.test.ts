import type { Map as MapLibreMap } from 'maplibre-gl'
import { describe, expect, it } from 'vitest'

import { addDraftLayers } from './draft-drawing-layer.js'

describe('addDraftLayers', () => {
  it('adds a high-contrast casing and solid line for visible drawing feedback', () => {
    const layers: Array<{ id?: string; paint?: Record<string, unknown> }> = []
    const map = {
      addLayer: (layer: { id?: string; paint?: Record<string, unknown> }) => layers.push(layer),
    } as unknown as MapLibreMap

    addDraftLayers(map)

    const casing = layers.find((layer) => layer.id === 'draft-line-casing')
    const line = layers.find((layer) => layer.id === 'draft-line')

    expect(casing?.paint?.['line-color']).toBe('#ffffff')
    expect(casing?.paint?.['line-width']).toBe(7)
    expect(line?.paint?.['line-color']).toBe('#ff5a1f')
    expect(line?.paint?.['line-width']).toBe(4)
  })
})
