import type {
  DrawableMeasurementGeometryKind,
  GeoJsonGeometry,
  Measurement,
  MeasurementGeometryKind,
  TreatmentFacility,
  TransportRoute,
  WorkItem,
} from '@dove/contracts'

import { FieldPanel } from '../field/field-panel.js'
import { DataToolsPanel } from './data-tools-panel.js'
import { MeasurementCompactInfo } from './measurement-compact-info.js'
import { MeasurementInspector } from './measurement-inspector.js'
import { RoutePlanner } from './route-planner.js'

export function MapDetailsPanel(props: {
  compactAddition: boolean
  defaultName: string
  draftGeometry: GeoJsonGeometry | null
  draftReady: boolean
  editMode: boolean
  facilities: TreatmentFacility[]
  initialCalculationInputs: Record<string, number>
  measurement: Measurement | null
  onCancel(): void
  onChanged(measurement: Measurement): Promise<void>
  onDataChanged(measurement?: Measurement): Promise<void>
  onEdit(): void
  onError(message: string): void
  onRoutePreview(geometry: GeoJsonGeometry | null): void
  onRouteSaved(route: TransportRoute): Promise<void>
  onSaved(measurement: Measurement, action: 'continue' | 'done'): Promise<void>
  selectedKind: MeasurementGeometryKind | null
  selectedWork: WorkItem | null
}) {
  const drawableKind: DrawableMeasurementGeometryKind | null =
    props.selectedKind === 'point' || props.selectedKind === 'line' || props.selectedKind === 'area'
      ? props.selectedKind
      : null
  const compactInfo =
    import.meta.env.VITE_LEGACY_CASE_DASHBOARD !== 'true' &&
    props.measurement &&
    !props.draftReady &&
    !props.editMode

  if (compactInfo && props.measurement) {
    return (
      <section className="measurement-panel measurement-panel--compact-info">
        <MeasurementCompactInfo measurement={props.measurement} />
        <FieldPanel
          gpsKind={null}
          measurement={props.measurement}
          onChanged={(measurement) => props.onChanged(measurement)}
          onError={(message) => props.onError(message)}
          photosOnly
          workItem={props.selectedWork}
        />
      </section>
    )
  }

  return (
    <section className="measurement-panel">
      {props.selectedKind === 'route' && props.selectedWork ? (
        <RoutePlanner
          facilities={props.facilities}
          measurement={props.measurement}
          workItem={props.selectedWork}
          onError={(message) => props.onError(message)}
          onPreview={(geometry) => props.onRoutePreview(geometry)}
          onSaved={(route) => props.onRouteSaved(route)}
        />
      ) : (
        <MeasurementInspector
          compactAddition={props.compactAddition}
          defaultName={props.defaultName}
          draftGeometry={props.draftGeometry}
          draftReady={props.draftReady}
          editMode={props.editMode}
          initialCalculationInputs={props.initialCalculationInputs}
          measurement={props.measurement}
          selectedKind={drawableKind}
          selectedWork={props.selectedWork}
          onCancel={() => props.onCancel()}
          onChanged={(measurement) => props.onChanged(measurement)}
          onEdit={() => props.onEdit()}
          onError={(message) => props.onError(message)}
          onSaved={(measurement, action) => props.onSaved(measurement, action)}
        />
      )}
      {!props.compactAddition && (
        <>
          <FieldPanel
            measurement={props.measurement}
            workItem={props.selectedWork}
            gpsKind={
              props.selectedKind === 'line' || props.selectedKind === 'point'
                ? props.selectedKind
                : null
            }
            onError={(message) => props.onError(message)}
            onChanged={(measurement) => props.onChanged(measurement)}
          />
          <DataToolsPanel
            allowImport={drawableKind !== null}
            onError={(message) => props.onError(message)}
            workItem={props.selectedWork}
            onChanged={(measurement) => props.onDataChanged(measurement)}
          />
        </>
      )}
    </section>
  )
}
