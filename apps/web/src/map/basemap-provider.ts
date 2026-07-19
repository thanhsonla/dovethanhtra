import type { StyleSpecification } from 'maplibre-gl'

export interface BasemapDescriptor {
  attribution: string
  id: string
  label: string
  style: StyleSpecification | string
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
      label: 'Kỹ thuật sáng',
      style: technicalStyle('#edf2ee'),
    },
    {
      attribution: 'Nền kỹ thuật local · Không phải bản đồ địa chính',
      id: 'technical-dark',
      label: 'Kỹ thuật tối',
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
    label: 'Vệ tinh Mapbox',
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

export class ConfiguredBasemapProvider implements BasemapProvider {
  private readonly local = new LocalTechnicalBasemapProvider()
  private readonly remote: BasemapDescriptor | null
  private readonly satellite: BasemapDescriptor | null
  readonly defaultId: string

  constructor(environment: BasemapEnvironment) {
    this.remote = remoteDescriptor(environment)
    this.satellite = mapboxSatelliteDescriptor(environment)
    this.defaultId = this.satellite?.id ?? this.remote?.id ?? this.local.defaultId
  }

  descriptors() {
    return [
      ...(this.satellite ? [this.satellite] : []),
      ...(this.remote ? [this.remote] : []),
      ...this.local.descriptors(),
    ]
  }

  get(id: string) {
    return this.descriptors().find((item) => item.id === id) ?? this.local.get(id)
  }

  supportsOffline(id: string) {
    if (this.remote?.id === id || this.satellite?.id === id) return false
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
): BasemapProvider {
  return new ConfiguredBasemapProvider(environment)
}
