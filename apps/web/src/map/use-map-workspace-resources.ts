import type {
  GeoJsonGeometry,
  MeasurementListResponse,
  TreatmentFacility,
  WorkItem,
} from '@dove/contracts'
import { useEffect, useState } from 'react'

import { api } from '../api.js'
import { createBasemapProvider } from './basemap-provider.js'

export function useMapWorkspaceResources(
  caseId: string,
  measurable: WorkItem[],
  onError: (message: string) => void,
) {
  const [basemaps, setBasemaps] = useState(() => createBasemapProvider())
  const [basemapId, setBasemapId] = useState(basemaps.defaultId)
  const [boundary, setBoundary] = useState<GeoJsonGeometry | null>(null)
  const [facilities, setFacilities] = useState<TreatmentFacility[]>([])
  const [summaries, setSummaries] = useState<Record<string, MeasurementListResponse>>({})

  useEffect(() => {
    void api
      .basemapCapabilities()
      .then((capabilities) => {
        if (!capabilities.googleMapTiles) return
        const next = createBasemapProvider(undefined, capabilities)
        setBasemaps(next)
        setBasemapId(next.defaultId)
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    void Promise.all([
      api.getCaseMapContext(caseId),
      api.listTreatmentFacilities(),
      ...measurable.map((item) => api.listMeasurements(item.id, { limit: 200 })),
    ])
      .then(([context, treatmentFacilities, ...items]) => {
        setBoundary(context.boundary)
        setFacilities(treatmentFacilities)
        setSummaries(
          Object.fromEntries(measurable.map((workItem, index) => [workItem.id, items[index]!])),
        )
      })
      .catch((reason: unknown) =>
        onError(reason instanceof Error ? reason.message : 'Không tải được bản đồ.'),
      )
  }, [caseId])

  const refreshWork = async (workItemId: string) => {
    const summary = await api.listMeasurements(workItemId, { limit: 200 })
    setSummaries((current) => ({ ...current, [workItemId]: summary }))
    return summary
  }

  return {
    basemapId,
    basemaps,
    boundary,
    facilities,
    refreshWork,
    setBasemapId,
    setSummaries,
    summaries,
  }
}
