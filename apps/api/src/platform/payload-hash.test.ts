import { describe, expect, it } from 'vitest'

import { payloadHash } from './payload-hash.js'

describe('payloadHash', () => {
  it('is stable when object keys arrive in a different order', () => {
    expect(
      payloadHash({ geometry: { coordinates: [104.6, 20.8], type: 'Point' }, localId: 'a' }),
    ).toBe(payloadHash({ localId: 'a', geometry: { type: 'Point', coordinates: [104.6, 20.8] } }))
  })

  it('changes when an ordered coordinate or value changes', () => {
    expect(payloadHash({ coordinates: [104.6, 20.8] })).not.toBe(
      payloadHash({ coordinates: [20.8, 104.6] }),
    )
  })
})
