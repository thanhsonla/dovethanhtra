import type { MeasurementListResponse, WorkItem, WorkType } from '@dove/contracts'

export interface WorkProgress {
  confirmed: number
  hasData: boolean
  id: string
  name: string
  review: number
  typeName: string
}

export function workProgress(
  workItems: WorkItem[],
  workTypes: WorkType[],
  summaries: Record<string, MeasurementListResponse>,
): WorkProgress[] {
  return workItems.map((workItem) => {
    const items = summaries[workItem.id]?.items ?? []
    const confirmed = items.filter((item) => item.status === 'confirmed').length
    const review = items.filter(
      (item) => item.status === 'draft' || item.status === 'needs_attention',
    ).length
    return {
      confirmed,
      hasData: items.some((item) => item.status !== 'superseded'),
      id: workItem.id,
      name: workItem.name,
      review,
      typeName:
        workTypes.find((type) => type.id === workItem.workTypeId)?.name ?? workItem.workTypeCode,
    }
  })
}

export function nextWorkToVisit(
  items: WorkProgress[],
  selectedWorkId: string,
): WorkProgress | null {
  return (
    items.find((item) => item.id !== selectedWorkId && item.review > 0) ??
    items.find((item) => item.id !== selectedWorkId && !item.hasData) ??
    null
  )
}
