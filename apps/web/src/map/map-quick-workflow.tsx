import type {
  DrawableMeasurementGeometryKind,
  InspectionCase,
  Measurement,
  MeasurementListResponse,
  WorkItem,
  WorkType,
} from '@dove/contracts'

import { ActiveWorkCard } from './active-work-card.js'
import type { MapMode } from './measurement-map.js'
import { MeasurementReviewQueue } from './measurement-review-queue.js'
import { WorkProgressPanel } from './work-progress-panel.js'

export function MapQuickWorkflow(props: {
  inspectionCase: InspectionCase
  mode: MapMode
  onConfirm(measurement: Measurement): Promise<void>
  onError(message: string): void
  onOpenDetails(): void
  onSelectMeasurement(measurement: Measurement): void
  onSelectWork(item: WorkItem): void
  onStart(mode: DrawableMeasurementGeometryKind, workItemId: string): void
  onWorkCreated(item: WorkItem): void
  selectedWork: WorkItem | null
  selectedWorkId: string
  summaries: Record<string, MeasurementListResponse>
  summary: MeasurementListResponse | undefined
  workItems: WorkItem[]
  workTypes: WorkType[]
}) {
  return (
    <div className="map-quick-workflow">
      <ActiveWorkCard
        inspectionCase={props.inspectionCase}
        mode={props.mode}
        onError={(message) => props.onError(message)}
        onOpenDetails={() => props.onOpenDetails()}
        onSelectWork={(workItem) => props.onSelectWork(workItem)}
        onStart={(mode, workItemId) => props.onStart(mode, workItemId)}
        onWorkCreated={(workItem) => props.onWorkCreated(workItem)}
        selectedWork={props.selectedWork}
        summary={props.summary}
        workItems={props.workItems}
        workTypes={props.workTypes}
      />
      <MeasurementReviewQueue
        inspectionLocked={props.inspectionCase.status === 'locked'}
        onConfirm={(measurement) => props.onConfirm(measurement)}
        onOpen={(measurement) => props.onSelectMeasurement(measurement)}
        summary={props.summary}
      />
      <WorkProgressPanel
        onSelect={(workItemId) => {
          const workItem = props.workItems.find((item) => item.id === workItemId)
          if (workItem) props.onSelectWork(workItem)
        }}
        selectedWorkId={props.selectedWorkId}
        summaries={props.summaries}
        workItems={props.workItems}
        workTypes={props.workTypes}
      />
    </div>
  )
}
