import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import { SharpThumbnailer } from './thumbnailer.js'

describe('SharpThumbnailer', () => {
  it('creates a bounded WebP copy without modifying the original bytes', async () => {
    const original = await sharp({
      create: { width: 900, height: 600, channels: 3, background: '#397d67' },
    })
      .png()
      .toBuffer()
    const before = Buffer.from(original)
    const thumbnail = await new SharpThumbnailer().create(original)
    const metadata = await sharp(thumbnail.bytes).metadata()
    expect(thumbnail.contentType).toBe('image/webp')
    expect(metadata.format).toBe('webp')
    expect(metadata.width).toBe(480)
    expect(metadata.height).toBe(320)
    expect(original).toEqual(before)
  })
})
