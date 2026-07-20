import type {
  MapFeature,
  MapFeatureConfirmedTotal,
  MeasurementGeometryKind,
  MeasurementStatus,
} from '@dove/contracts'
import { useCallback, useEffect, useRef, useState } from 'react'

import { api } from '../api.js'

export interface MapFeatureFilters {
  componentId: string
  geometryKind: '' | MeasurementGeometryKind
  managementZoneId: string
  serviceGroupId: string
  status: '' | MeasurementStatus
  workItemId: string
}

export const emptyMapFeatureFilters: MapFeatureFilters = {
  componentId: '',
  geometryKind: '',
  managementZoneId: '',
  serviceGroupId: '',
  status: '',
  workItemId: '',
}

function options(filters: MapFeatureFilters, bbox: string, cursor?: string) {
  return {
    ...(bbox ? { bbox } : {}),
    ...(filters.componentId ? { componentId: filters.componentId } : {}),
    ...(cursor ? { cursor } : {}),
    ...(filters.geometryKind ? { geometryKind: filters.geometryKind } : {}),
    limit: 200,
    ...(filters.managementZoneId ? { managementZoneId: filters.managementZoneId } : {}),
    ...(filters.serviceGroupId ? { serviceGroupId: filters.serviceGroupId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.workItemId ? { workItemId: filters.workItemId } : {}),
  }
}

export function useMapFeatures(caseId: string, onError: (message: string) => void) {
  const [bbox, setBbox] = useState('')
  const [filters, setFilters] = useState<MapFeatureFilters>(emptyMapFeatureFilters)
  const [items, setItems] = useState<MapFeature[]>([])
  const [confirmedTotals, setConfirmedTotals] = useState<MapFeatureConfirmedTotal[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const requestId = useRef(0)

  const load = useCallback(
    async (cursor?: string) => {
      const id = ++requestId.current
      setLoading(true)
      try {
        const page = await api.listMapFeatures(caseId, options(filters, bbox, cursor))
        if (id !== requestId.current) return
        setItems((current) => (cursor ? [...current, ...page.items] : page.items))
        setConfirmedTotals(page.confirmedTotals)
        setNextCursor(page.nextCursor)
      } catch (reason) {
        if (id === requestId.current) {
          onError(reason instanceof Error ? reason.message : 'Không tải được dữ liệu bản đồ.')
        }
      } finally {
        if (id === requestId.current) setLoading(false)
      }
    },
    [bbox, caseId, filters, onError],
  )

  useEffect(() => {
    void load()
  }, [load])

  return {
    confirmedTotals,
    filters,
    items,
    loading,
    nextCursor,
    loadMore: () => (nextCursor ? load(nextCursor) : Promise.resolve()),
    refresh: () => load(),
    setBbox,
    setFilters,
  }
}
