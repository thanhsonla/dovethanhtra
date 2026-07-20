import type {
  ClassifyCaptureDraftRequest,
  DrawableMeasurementGeometryKind,
  WorkItem,
  WorkType,
} from '@dove/contracts'

export function compatibleWorkTypes(
  workTypes: WorkType[],
  serviceGroupId: string,
  geometryKind: DrawableMeasurementGeometryKind,
) {
  return workTypes.filter(
    (item) =>
      item.active &&
      item.serviceGroupId === serviceGroupId &&
      item.measurementKind === geometryKind,
  )
}

export function compatibleWorkItems(
  workItems: WorkItem[],
  zoneId: string,
  serviceGroupId: string,
  geometryKind: DrawableMeasurementGeometryKind,
) {
  return workItems.filter(
    (item) =>
      !item.deletedAt &&
      item.status !== 'archived' &&
      item.managementZoneId === zoneId &&
      item.serviceGroupId === serviceGroupId &&
      item.measurementKind === geometryKind,
  )
}

export function classificationPayload(input: {
  componentId: string
  componentName: string
  measurementName: string
  note: string
  workItemId: string
  workItemName: string
  workTypeId: string
  zoneId: string
}): ClassifyCaptureDraftRequest {
  const payload: ClassifyCaptureDraftRequest = {
    measurementName: input.measurementName.trim(),
    note: input.note.trim() || null,
  }
  if (input.workItemId === 'new') {
    payload.createWorkItem = {
      managementZoneId: input.zoneId,
      name: input.workItemName.trim(),
      workTypeId: input.workTypeId,
    }
  } else {
    payload.workItemId = input.workItemId
  }
  if (input.componentId === 'new') {
    payload.createWorkComponent = { name: input.componentName.trim() }
  } else if (input.componentId) {
    payload.workComponentId = input.componentId
  }
  return payload
}
