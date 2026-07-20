import type { Measurement } from '@dove/contracts'

import type { QueryExecutor } from '../../platform/database.js'
import type { AuditRepository } from '../audit/audit-repository.js'
import type { ClassificationStructure } from './capture-classification-port.js'
import type { CaptureDraftRecord } from './capture-draft-repository.js'
import { measurementAuditSummary } from './measurement-audit.js'

export function captureDraftAuditSummary(record: CaptureDraftRecord) {
  return {
    geometryKind: record.geometryKind,
    id: record.id,
    localId: record.localId,
    status: record.status,
    version: record.version,
  }
}

export async function appendCaptureClassificationAudit(
  audit: AuditRepository,
  executor: QueryExecutor,
  before: CaptureDraftRecord,
  after: CaptureDraftRecord,
  measurement: Measurement,
  structure: ClassificationStructure,
  actorId: string,
  traceId: string,
) {
  if (structure.createdWorkItem) {
    await audit.append(executor, {
      action: 'created_during_classification',
      actorId,
      afterData: { id: structure.createdWorkItem.id, name: structure.createdWorkItem.name },
      entityId: structure.createdWorkItem.id,
      entityType: 'case_work_item',
      inspectionCaseId: before.caseId,
      traceId,
    })
  }
  if (structure.createdComponent) {
    await audit.append(executor, {
      action: 'created_during_classification',
      actorId,
      afterData: { id: structure.createdComponent.id, name: structure.createdComponent.name },
      entityId: structure.createdComponent.id,
      entityType: 'work_component',
      inspectionCaseId: before.caseId,
      traceId,
    })
  }
  await audit.append(executor, {
    action: 'created_from_capture',
    actorId,
    afterData: measurementAuditSummary(measurement),
    entityId: measurement.id,
    entityType: 'measurement',
    inspectionCaseId: before.caseId,
    traceId,
  })
  await audit.append(executor, {
    action: 'classified',
    actorId,
    beforeData: captureDraftAuditSummary(before),
    afterData: {
      ...captureDraftAuditSummary(after),
      measurementId: measurement.id,
      workComponentId: structure.workComponentId,
      workItemId: structure.workItemId,
    },
    entityId: after.id,
    entityType: 'capture_draft',
    inspectionCaseId: before.caseId,
    traceId,
  })
}
