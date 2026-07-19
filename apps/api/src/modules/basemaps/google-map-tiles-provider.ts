import { AppError } from '../../platform/app-error.js'

interface GoogleSessionResponse {
  expiry?: string
  imageFormat?: string
  session?: string
  tileHeight?: number
  tileWidth?: number
}

interface GoogleViewportResponse {
  copyright?: string
  maxZoomRects?: Array<{ maxZoom?: number }>
}

export interface GoogleMapTile {
  bytes: Buffer
  contentType: string
}

export interface GoogleMapViewport {
  attribution: string
  maxZoom?: number
}

export interface GoogleMapTiles {
  getTile(z: number, x: number, y: number): Promise<GoogleMapTile>
  getViewport(input: {
    east: number
    north: number
    south: number
    west: number
    zoom: number
  }): Promise<GoogleMapViewport>
}

export class GoogleMapTilesProvider implements GoogleMapTiles {
  private session: { expiresAt: number; token: string } | null = null
  private sessionRequest: Promise<string> | null = null

  constructor(
    private readonly apiKey: string,
    private readonly timeoutMs: number,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  private async response(url: URL, init?: RequestInit): Promise<Response> {
    try {
      return await this.fetcher(url, { ...init, signal: AbortSignal.timeout(this.timeoutMs) })
    } catch {
      throw new AppError(
        502,
        'GOOGLE_MAP_TILES_UNAVAILABLE',
        'Không kết nối được dịch vụ bản đồ Google.',
      )
    }
  }

  private async createSession(): Promise<string> {
    const url = new URL('https://tile.googleapis.com/v1/createSession')
    url.searchParams.set('key', this.apiKey)
    const response = await this.response(url, {
      body: JSON.stringify({
        language: 'vi-VN',
        layerTypes: ['layerRoadmap'],
        mapType: 'satellite',
        overlay: false,
        region: 'VN',
        scale: 'scaleFactor1x',
      }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })
    if (response.status === 429) {
      throw new AppError(503, 'GOOGLE_MAP_TILES_QUOTA', 'Đã vượt hạn mức bản đồ Google.')
    }
    const payload = (await response.json().catch(() => ({}))) as GoogleSessionResponse
    if (!response.ok || !payload.session || payload.session.length > 2_000) {
      throw new AppError(502, 'GOOGLE_MAP_TILES_REJECTED', 'Google từ chối tạo phiên bản đồ.')
    }
    const expirySeconds = Number(payload.expiry)
    const expiresAt = Number.isFinite(expirySeconds)
      ? expirySeconds * 1_000
      : Date.now() + 12 * 60 * 60 * 1_000
    this.session = { expiresAt, token: payload.session }
    return payload.session
  }

  private async getSession(): Promise<string> {
    if (this.session && this.session.expiresAt - Date.now() > 5 * 60 * 1_000) {
      return this.session.token
    }
    if (!this.sessionRequest) {
      this.sessionRequest = this.createSession().finally(() => {
        this.sessionRequest = null
      })
    }
    return this.sessionRequest
  }

  private async googleGet(path: string, query: Record<string, string>): Promise<Response> {
    const session = await this.getSession()
    const url = new URL(path, 'https://tile.googleapis.com')
    Object.entries({ ...query, key: this.apiKey, session }).forEach(([key, value]) =>
      url.searchParams.set(key, value),
    )
    const response = await this.response(url)
    if (response.status === 429) {
      throw new AppError(503, 'GOOGLE_MAP_TILES_QUOTA', 'Đã vượt hạn mức bản đồ Google.')
    }
    if (!response.ok) {
      throw new AppError(502, 'GOOGLE_MAP_TILES_REJECTED', 'Google từ chối yêu cầu bản đồ.')
    }
    return response
  }

  async getTile(z: number, x: number, y: number): Promise<GoogleMapTile> {
    const response = await this.googleGet(`/v1/2dtiles/${z}/${x}/${y}`, {})
    const contentType = response.headers.get('content-type')
    return {
      bytes: Buffer.from(await response.arrayBuffer()),
      contentType: contentType?.startsWith('image/') ? contentType : 'image/png',
    }
  }

  async getViewport(input: {
    east: number
    north: number
    south: number
    west: number
    zoom: number
  }): Promise<GoogleMapViewport> {
    const response = await this.googleGet('/tile/v1/viewport', {
      east: String(input.east),
      north: String(input.north),
      south: String(input.south),
      west: String(input.west),
      zoom: String(input.zoom),
    })
    const payload = (await response.json().catch(() => ({}))) as GoogleViewportResponse
    const maxZooms = (payload.maxZoomRects ?? [])
      .map((item) => item.maxZoom)
      .filter((value): value is number => Number.isInteger(value) && value! >= 0 && value! <= 22)
    return {
      attribution: payload.copyright?.slice(0, 2_000) || 'Google Maps',
      ...(maxZooms.length ? { maxZoom: Math.max(...maxZooms) } : {}),
    }
  }
}
