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

export class ConfiguredBasemapProvider implements BasemapProvider {
  private readonly local = new LocalTechnicalBasemapProvider()
  private readonly remote: BasemapDescriptor | null
  readonly defaultId: string

  constructor(environment: BasemapEnvironment) {
    this.remote = remoteDescriptor(environment)
    this.defaultId = this.remote?.id ?? this.local.defaultId
  }

  descriptors() {
    return this.remote ? [this.remote, ...this.local.descriptors()] : this.local.descriptors()
  }

  get(id: string) {
    return this.descriptors().find((item) => item.id === id) ?? this.local.get(id)
  }

  supportsOffline(id: string) {
    return this.remote?.id === id ? false : this.local.supportsOffline(id)
  }
}

export function createBasemapProvider(
  environment: BasemapEnvironment = {
    VITE_BASEMAP_ATTRIBUTION: import.meta.env.VITE_BASEMAP_ATTRIBUTION,
    VITE_BASEMAP_LABEL: import.meta.env.VITE_BASEMAP_LABEL,
    VITE_BASEMAP_STYLE_URL: import.meta.env.VITE_BASEMAP_STYLE_URL,
  },
): BasemapProvider {
  return new ConfiguredBasemapProvider(environment)
}
