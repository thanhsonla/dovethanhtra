import type { StyleSpecification } from 'maplibre-gl'

export interface BasemapViewport {
  east: number
  north: number
  south: number
  west: number
  zoom: number
}

export interface BasemapDescriptor {
  attribution: string
  id: string
  label: string
  lockRotation?: boolean
  loadStyle?: () => Promise<StyleSpecification>
  style: StyleSpecification | string
  viewportAttribution?: (viewport: BasemapViewport) => Promise<string>
}

export interface BasemapProvider {
  defaultId: string
  descriptors(): BasemapDescriptor[]
  get(id: string): BasemapDescriptor
  supportsOffline(id: string): boolean
}

export interface BasemapEnvironment {
  VITE_BASEMAP_ATTRIBUTION?: string | undefined
  VITE_BASEMAP_LABEL?: string | undefined
  VITE_BASEMAP_STYLE_URL?: string | undefined
  VITE_MAPBOX_PUBLIC_TOKEN?: string | undefined
}
export interface BasemapCapabilities {
  googleMapTiles?: boolean
}

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]!,
  )
}

function technicalStyle(background: string): StyleSpecification {
  return {
    version: 8,
    sources: {},
    layers: [
      { id: 'technical-background', type: 'background', paint: { 'background-color': background } },
    ],
  }
}

export class LocalTechnicalBasemapProvider implements BasemapProvider {
  defaultId = 'technical-light'

  private readonly items: BasemapDescriptor[] = [
    {
      attribution: 'Nền kỹ thuật local · Không phải bản đồ địa chính',
      id: 'technical-light',
      label: 'Kỹ thuật sáng · kiểm thử',
      style: technicalStyle('#edf2ee'),
    },
    {
      attribution: 'Nền kỹ thuật local · Không phải bản đồ địa chính',
      id: 'technical-dark',
      label: 'Kỹ thuật tối · kiểm thử',
      style: technicalStyle('#1d2924'),
    },
  ]

  descriptors() {
    return this.items
  }

  get(id: string) {
    return this.items.find((item) => item.id === id) ?? this.items[0]!
  }

  supportsOffline(id: string) {
    return this.items.some((item) => item.id === id)
  }
}

function remoteDescriptor(environment: BasemapEnvironment): BasemapDescriptor | null {
  const styleUrl = environment.VITE_BASEMAP_STYLE_URL?.trim()
  const attribution = environment.VITE_BASEMAP_ATTRIBUTION?.trim()
  if (!styleUrl || !attribution) return null
  try {
    const parsed = new URL(styleUrl)
    const localHttp =
      parsed.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(parsed.hostname)
    if ((parsed.protocol !== 'https:' && !localHttp) || parsed.username || parsed.password) {
      return null
    }
  } catch {
    return null
  }
  return {
    attribution,
    id: 'configured-remote',
    label: environment.VITE_BASEMAP_LABEL?.trim() || 'Nền được cấu hình',
    style: styleUrl,
  }
}

function mapboxSatelliteDescriptor(environment: BasemapEnvironment): BasemapDescriptor | null {
  const token = environment.VITE_MAPBOX_PUBLIC_TOKEN?.trim()
  if (!token || !/^pk\.[A-Za-z0-9._-]+$/.test(token) || token.length > 500) return null
  const tileUrl =
    'https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/256/' +
    `{z}/{x}/{y}?access_token=${encodeURIComponent(token)}`
  return {
    attribution:
      '<a href="https://www.mapbox.com/about/maps/">© Mapbox</a> ' +
      '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a>',
    id: 'mapbox-satellite',
    label: 'Vệ tinh Mapbox + địa danh',
    lockRotation: true,
    style: {
      version: 8,
      sources: {
        'mapbox-satellite': {
          type: 'raster',
          tiles: [tileUrl],
          tileSize: 256,
          maxzoom: 22,
        },
      },
      layers: [
        {
          id: 'mapbox-satellite',
          source: 'mapbox-satellite',
          type: 'raster',
        },
      ],
    },
  }
}

function mapboxApiUrl(url: string, token: string): string {
  const mapId = url.replace('mapbox://', '')
  return `https://api.mapbox.com/v4/${mapId}.json?secure&access_token=${encodeURIComponent(token)}`
}
export function prepareUprightGoogleHybridStyle(
  input: StyleSpecification,
  token: string,
): StyleSpecification {
  const style = JSON.parse(JSON.stringify(input)) as StyleSpecification
  const styleRecord = style as unknown as Record<string, unknown>
  const sources = style.sources as Record<string, { type: string; url?: string }>
  for (const property of [
    'created',
    'draft',
    'fog',
    'id',
    'modified',
    'name',
    'owner',
    'projection',
    'visibility',
  ]) {
    delete styleRecord[property]
  }
  delete sources['mapbox-satellite']
  for (const source of Object.values(sources)) {
    if (source.url?.startsWith('mapbox://')) source.url = mapboxApiUrl(source.url, token)
  }
  style.sources['google-satellite-upright'] = {
    type: 'raster',
    tiles: ['https://mt1.google.com/vt/lyrs=s&hl=vi&x={x}&y={y}&z={z}'],
    tileSize: 256,
    maxzoom: 22,
  }
  style.sprite =
    `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/sprite` +
    `?access_token=${encodeURIComponent(token)}`
  style.glyphs =
    `https://api.mapbox.com/fonts/v1/mapbox/{fontstack}/{range}.pbf` +
    `?access_token=${encodeURIComponent(token)}`
  style.layers = style.layers.map((layer) => {
    if (layer.id === 'satellite' && layer.type === 'raster') {
      return { ...layer, source: 'google-satellite-upright' }
    }
    if (layer.type !== 'symbol') return layer
    const placement = layer.layout?.['symbol-placement']
    const followsLine = placement === 'line' || placement === 'line-center'
    return {
      ...layer,
      layout: {
        ...layer.layout,
        'icon-pitch-alignment': 'viewport',
        'icon-rotation-alignment': 'viewport',
        'text-keep-upright': true,
        'text-pitch-alignment': followsLine ? 'map' : 'viewport',
        'text-rotation-alignment': followsLine ? 'map' : 'viewport',
      },
    }
  })
  return style
}

function uprightGoogleHybridDescriptor(
  environment: BasemapEnvironment,
  fetcher: Fetcher,
): BasemapDescriptor | null {
  const token = environment.VITE_MAPBOX_PUBLIC_TOKEN?.trim()
  if (!token || !/^pk\.[A-Za-z0-9._-]+$/.test(token) || token.length > 500) return null
  const styleUrl =
    'https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12' +
    `?access_token=${encodeURIComponent(token)}`
  return {
    attribution:
      '<a href="https://maps.google.com/">Google Maps</a> · ' +
      '<a href="https://www.mapbox.com/about/maps/">© Mapbox</a> · ' +
      '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a>',
    id: 'google-hybrid-upright',
    label: 'Google vệ tinh · nhãn dễ đọc',
    style: technicalStyle('#18211d'),
    loadStyle: async () => {
      const response = await fetcher(styleUrl)
      if (!response.ok) throw new Error('Không tải được style nhãn bản đồ.')
      return prepareUprightGoogleHybridStyle((await response.json()) as StyleSpecification, token)
    },
  }
}
function esriImageryWithLabelsDescriptor(): BasemapDescriptor {
  const serviceRoot = 'https://server.arcgisonline.com/ArcGIS/rest/services'
  return {
    attribution:
      '<a href="https://www.esri.com/">© Esri</a> · Source: Esri, Vantor, ' +
      'Earthstar Geographics, GIS User Community · Reference: Esri, HERE, Garmin, ' +
      '<a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
    id: 'esri-imagery-labels',
    label: 'Vệ tinh + địa danh',
    lockRotation: true,
    style: {
      version: 8,
      sources: {
        'esri-world-imagery': {
          type: 'raster',
          tiles: [`${serviceRoot}/World_Imagery/MapServer/tile/{z}/{y}/{x}`],
          tileSize: 256,
          maxzoom: 18,
        },
        'esri-boundaries-places': {
          type: 'raster',
          tiles: [
            `${serviceRoot}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`,
          ],
          tileSize: 256,
          maxzoom: 18,
        },
        'esri-transportation': {
          type: 'raster',
          tiles: [`${serviceRoot}/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}`],
          tileSize: 256,
          maxzoom: 18,
        },
      },
      layers: [
        { id: 'esri-world-imagery', source: 'esri-world-imagery', type: 'raster' },
        { id: 'esri-boundaries-places', source: 'esri-boundaries-places', type: 'raster' },
        { id: 'esri-transportation', source: 'esri-transportation', type: 'raster' },
      ],
    },
  }
}

function directGoogleHybridDescriptor(): BasemapDescriptor {
  return {
    attribution: '<a href="https://maps.google.com/">Google Maps</a>',
    id: 'google-hybrid-direct',
    label: 'Google vệ tinh + địa danh · khóa hướng Bắc',
    lockRotation: true,
    style: {
      version: 8,
      sources: {
        'google-hybrid-direct': {
          type: 'raster',
          tiles: ['https://mt1.google.com/vt/lyrs=y&hl=vi&x={x}&y={y}&z={z}'],
          tileSize: 256,
          maxzoom: 22,
        },
      },
      layers: [
        {
          id: 'google-hybrid-direct',
          source: 'google-hybrid-direct',
          type: 'raster',
        },
      ],
    },
  }
}

function googleSatelliteDescriptor(fetcher: Fetcher): BasemapDescriptor {
  const attribution = '<a href="https://maps.google.com/">Google Maps</a>'
  return {
    attribution,
    id: 'google-satellite-labels',
    label: 'Google vệ tinh + địa danh · khóa hướng Bắc',
    lockRotation: true,
    style: {
      version: 8,
      sources: {
        'google-satellite-labels': {
          type: 'raster',
          tiles: ['/api/v1/basemaps/google/tiles/{z}/{x}/{y}'],
          tileSize: 256,
          maxzoom: 22,
        },
      },
      layers: [
        {
          id: 'google-satellite-labels',
          source: 'google-satellite-labels',
          type: 'raster',
        },
      ],
    },
    viewportAttribution: async (viewport) => {
      const query = new URLSearchParams(
        Object.fromEntries(Object.entries(viewport).map(([key, value]) => [key, String(value)])),
      )
      const response = await fetcher(`/api/v1/basemaps/google/viewport?${query}`, {
        credentials: 'same-origin',
      })
      if (!response.ok) return attribution
      const payload = (await response.json().catch(() => null)) as {
        attribution?: unknown
      } | null
      return typeof payload?.attribution === 'string'
        ? `${attribution} · ${escapeHtml(payload.attribution)}`
        : attribution
    },
  }
}

export class ConfiguredBasemapProvider implements BasemapProvider {
  private readonly local = new LocalTechnicalBasemapProvider()
  private readonly remote: BasemapDescriptor | null
  private readonly satellite: BasemapDescriptor | null
  private readonly uprightGoogle: BasemapDescriptor | null
  private readonly google: BasemapDescriptor | null
  private readonly directGoogle = directGoogleHybridDescriptor()
  private readonly esri = esriImageryWithLabelsDescriptor()
  readonly defaultId: string

  constructor(
    environment: BasemapEnvironment,
    capabilities: BasemapCapabilities = {},
    fetcher: Fetcher = fetch,
  ) {
    this.remote = remoteDescriptor(environment)
    this.satellite = mapboxSatelliteDescriptor(environment)
    this.uprightGoogle = uprightGoogleHybridDescriptor(environment, fetcher)
    this.google = capabilities.googleMapTiles ? googleSatelliteDescriptor(fetcher) : null
    this.defaultId = this.uprightGoogle?.id ?? this.google?.id ?? this.directGoogle.id
  }

  descriptors() {
    return [
      ...(this.uprightGoogle ? [this.uprightGoogle] : []),
      ...(this.google ? [this.google] : []),
      this.directGoogle,
      this.esri,
      ...(this.satellite ? [this.satellite] : []),
      ...(this.remote ? [this.remote] : []),
      ...this.local.descriptors(),
    ]
  }

  get(id: string) {
    return this.descriptors().find((item) => item.id === id) ?? this.local.get(id)
  }

  supportsOffline(id: string) {
    if (
      this.remote?.id === id ||
      this.satellite?.id === id ||
      this.uprightGoogle?.id === id ||
      this.google?.id === id ||
      this.directGoogle.id === id ||
      this.esri.id === id
    )
      return false
    return this.local.supportsOffline(id)
  }
}

export function createBasemapProvider(
  environment: BasemapEnvironment = {
    VITE_BASEMAP_ATTRIBUTION: import.meta.env.VITE_BASEMAP_ATTRIBUTION,
    VITE_BASEMAP_LABEL: import.meta.env.VITE_BASEMAP_LABEL,
    VITE_BASEMAP_STYLE_URL: import.meta.env.VITE_BASEMAP_STYLE_URL,
    VITE_MAPBOX_PUBLIC_TOKEN: import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN,
  },
  capabilities: BasemapCapabilities = {},
  fetcher: Fetcher = fetch,
): BasemapProvider {
  return new ConfiguredBasemapProvider(environment, capabilities, fetcher)
}
