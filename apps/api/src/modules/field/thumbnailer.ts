import sharp from 'sharp'

export interface ThumbnailArtifact {
  bytes: Buffer
  contentType: 'image/webp'
}

export interface Thumbnailer {
  create(bytes: Buffer): Promise<ThumbnailArtifact>
}

export class SharpThumbnailer implements Thumbnailer {
  async create(bytes: Buffer): Promise<ThumbnailArtifact> {
    const output = await sharp(bytes, { failOn: 'error' })
      .rotate()
      .resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer()
    return { bytes: output, contentType: 'image/webp' }
  }
}
