import type { MeasurementGeometryKind, WorkItem, WorkType } from '@dove/contracts'

export function activeWorkId(caseId: string, items: WorkItem[]): string {
  if (typeof window === 'undefined') return items[0]?.id ?? ''
  const stored = window.sessionStorage.getItem(`dove-active-work:${caseId}`)
  return items.some((item) => item.id === stored) ? stored! : (items[0]?.id ?? '')
}

export function measurementKindForWork(
  item: WorkItem,
  workTypes: WorkType[],
): MeasurementGeometryKind | null {
  const kind = workTypes.find((type) => type.id === item.workTypeId)?.measurementKind
  return kind === 'point' || kind === 'line' || kind === 'area' || kind === 'route' ? kind : null
}

export function rememberActiveWork(caseId: string, workItemId: string) {
  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(`dove-active-work:${caseId}`, workItemId)
  }
}
