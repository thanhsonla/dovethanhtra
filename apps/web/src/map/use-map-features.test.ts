import { describe, expect, it } from 'vitest'

import { inventoryOptions } from './use-map-features.js'

describe('map feature inventory query', () => {
  it('paginates the complete case inventory without a viewport bounding box', () => {
    expect(inventoryOptions()).toEqual({ limit: 200 })
    expect(inventoryOptions('next-page')).toEqual({ cursor: 'next-page', limit: 200 })
    expect(inventoryOptions()).not.toHaveProperty('bbox')
  })
})
