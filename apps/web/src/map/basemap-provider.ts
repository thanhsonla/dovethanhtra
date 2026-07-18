import type { StyleSpecification } from 'maplibre-gl'

export interface BasemapDescriptor {
  attribution: string
  id: string
  label: string
  style: StyleSpecification
}

export interface BasemapProvider {
  defaultId: string
  descriptors(): BasemapDescriptor[]
  get(id: string): BasemapDescriptor
  supportsOffline(id: string): boolean
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
