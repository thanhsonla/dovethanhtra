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
  search: string
  serviceGroupId: string
  status: '' | MeasurementStatus
  workItemId: string
}

export const emptyMapFeatureFilters: MapFeatureFilters = {
  componentId: '',
  geometryKind: '',
  managementZoneId: '',
  search: '',
  serviceGroupId: '',
  status: '',
  workItemId: '',
}

function options(filters: MapFeatureFilters, bbox: string, cursor?: string) {
  const searchingByNameOrCatalog = Boolean(
    filters.search.trim() ||
    filters.managementZoneId ||
    filters.serviceGroupId ||
    filters.workItemId,
  )
  return {
    ...(bbox && !searchingByNameOrCatalog ? { bbox } : {}),
    ...(filters.componentId ? { componentId: filters.componentId } : {}),
    ...(cursor ? { cursor } : {}),
    ...(filters.geometryKind ? { geometryKind: filters.geometryKind } : {}),
    limit: 200,
    ...(filters.managementZoneId ? { managementZoneId: filters.managementZoneId } : {}),
    ...(filters.search.trim() ? { search: filters.search.trim() } : {}),
    ...(filters.serviceGroupId ? { serviceGroupId: filters.serviceGroupId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.workItemId ? { workItemId: filters.workItemId } : {}),
  }
}

export function inventoryOptions(cursor?: string) {
  return { ...(cursor ? { cursor } : {}), limit: 200 }
}

function replaceInList(
  current: MapFeature[],
  previousId: string,
  feature: MapFeature,
  appendWhenMissing: boolean,
) {
  const index = current.findIndex((item) => item.measurement.id === previousId)
  if (index < 0) return appendWhenMissing ? [...current, feature] : current
  const next = [...current]
  next[index] = feature
  return next
}

export function useMapFeatures(caseId: string, onError: (message: string) => void) {
  const [bbox, setBbox] = useState('')
  const [filters, setFilters] = useState<MapFeatureFilters>(emptyMapFeatureFilters)
  const [items, setItems] = useState<MapFeature[]>([])
  const [inventoryItems, setInventoryItems] = useState<MapFeature[]>([])
  const [confirmedTotals, setConfirmedTotals] = useState<MapFeatureConfirmedTotal[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [inventoryLoading, setInventoryLoading] = useState(false)

  const onErrorRef = useRef(onError)
  const requestId = useRef(0)
  const inventoryRequestId = useRef(0)

  // Keep refs in sync synchronously
  onErrorRef.current = onError

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
          onErrorRef.current(
            reason instanceof Error ? reason.message : 'Không tải được dữ liệu bản đồ.',
          )
        }
      } finally {
        if (id === requestId.current) setLoading(false)
      }
    },
    [caseId, filters, bbox],
  )

  useEffect(() => {
    void load()
  }, [load])

  const loadInventory = useCallback(async () => {
    const id = ++inventoryRequestId.current
    setInventoryLoading(true)
    try {
      const collected: MapFeature[] = []
      const seenIds = new Set<string>()
      const seenCursors = new Set<string>()
      let cursor: string | undefined
      do {
        const page = await api.listMapFeatures(caseId, inventoryOptions(cursor))
        if (id !== inventoryRequestId.current) return
        for (const feature of page.items) {
          if (seenIds.has(feature.measurement.id)) continue
          seenIds.add(feature.measurement.id)
          collected.push(feature)
        }
        setInventoryItems([...collected])
        if (!page.nextCursor || seenCursors.has(page.nextCursor)) break
        seenCursors.add(page.nextCursor)
        cursor = page.nextCursor
      } while (cursor)
      setInventoryItems(collected)
    } catch (reason) {
      if (id === inventoryRequestId.current) {
        onErrorRef.current(
          reason instanceof Error ? reason.message : 'Không tải được danh sách quản lý số liệu.',
        )
      }
    } finally {
      if (id === inventoryRequestId.current) setInventoryLoading(false)
    }
  }, [caseId])

  useEffect(() => {
    void loadInventory()
  }, [loadInventory])

  // Keep a ref to the current load so that callers holding a stale reference to
  // mapFeatures.refresh() still invoke the LATEST load (with current filters and
  // bbox). Without this, onDone closures that captured an old mapFeatures object
  // would call an old load with empty filters, producing incorrect results that
  // overwrite correctly-filtered items (stale-closure refresh bug).
  const loadRef = useRef(load)
  loadRef.current = load
  const loadInventoryRef = useRef(loadInventory)
  loadInventoryRef.current = loadInventory

  const replaceFeature = useCallback((previousId: string, feature: MapFeature) => {
    setItems((current) => replaceInList(current, previousId, feature, false))
    setInventoryItems((current) => replaceInList(current, previousId, feature, true))
  }, [])

  const removeFeature = useCallback((measurementId: string) => {
    setItems((current) => current.filter((item) => item.measurement.id !== measurementId))
    setInventoryItems((current) => current.filter((item) => item.measurement.id !== measurementId))
  }, [])

  return {
    confirmedTotals,
    filters,
    inventoryItems,
    inventoryLoading,
    items,
    loading,
    nextCursor,
    loadMore: () => (nextCursor ? load(nextCursor) : Promise.resolve()),
    refresh: () =>
      Promise.all([loadRef.current(), loadInventoryRef.current()]).then(() => undefined),
    removeFeature,
    replaceFeature,
    setBbox,
    setFilters,
  }
}
