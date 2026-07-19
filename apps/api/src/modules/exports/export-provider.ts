import type { CaseComparison, GeoJsonGeometry } from '@dove/contracts'

export interface ExportCase {
  id: string
  caseCode: string
  name: string
  adminAreaName: string
  periodStart: string
  periodEnd: string
  status: string
}

export interface ExportMeasurement {
  id: string
  workItemId: string
  workItemName: string
  groupName: string
  code: string
  name: string
  version: number
  method: string
  geometryKind: string
  calculatedQuantity: number | null
  unit: string
  status: string
  geometry: GeoJsonGeometry
}

export interface ExportSource {
  id: string
  workItemId: string
  sourceKind: string
  documentNo: string | null
  documentDate: string | null
  quantity: number
  unit: string
  periodStart: string | null
  periodEnd: string | null
  note: string | null
  attachmentId: string | null
}

export interface ExportDataset {
  inspectionCase: ExportCase
  comparison: CaseComparison
  measurements: ExportMeasurement[]
  sources: ExportSource[]
  generatedAt: string
}

export interface ExportArtifact {
  bytes: Buffer
  contentType: string
  extension: 'geojson' | 'xlsx'
}

export interface ExportProvider {
  create(format: 'geojson' | 'xlsx', data: ExportDataset): Promise<ExportArtifact>
}
