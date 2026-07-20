import type {
  AdminArea,
  AdminAreaBoundary,
  CaseComparison,
  CaseMapContext,
  CaseListResponse,
  CreateCaseRequest,
  CreateSourceQuantityRequest,
  CreateWorkTypeRequest,
  CreateWorkItemRequest,
  InspectionCase,
  ComparisonThreshold,
  Measurement,
  MeasurementListResponse,
  CreateMeasurementRequest,
  ConfirmMeasurementRequest,
  SupersedeMeasurementRequest,
  ServiceGroup,
  SessionResponse,
  SourceQuantity,
  WorkItem,
  WorkType,
  RouteCalculation,
  RouteRequest,
  SaveTransportRouteRequest,
  TreatmentFacility,
  TransportRoute,
  Attachment,
  AuditEvent,
  CreateGpsPointRequest,
  CreateGpsTrackRequest,
  GpsPointResponse,
  GpsTrackResponse,
  PresignAttachmentRequest,
  PresignAttachmentResponse,
  GeoJsonImportRequest,
  GeoJsonImportPreview,
  GeoJsonImportCommitResponse,
  ExportJob,
  BasemapCapabilities,
  CaptureDraft,
  CaptureDraftMutationResponse,
  ClassifyCaptureDraftRequest,
  ClassifyCaptureDraftResponse,
  CreateCaptureDraftRequest,
  ManagementZone,
  WorkComponent,
  MapFeatureListResponse,
  MeasurementGeometryKind,
  MeasurementStatus,
} from '@dove/contracts'

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string | null = null,
    public readonly details: unknown = null,
    public readonly traceId: string | null = null,
  ) {
    super(`${code ? `[${code}] ` : ''}${message}${traceId ? ` · trace ${traceId}` : ''}`)
  }
}

function csrfToken(): string {
  const item = document.cookie.split('; ').find((value) => value.startsWith('dove_csrf='))
  return item ? decodeURIComponent(item.slice('dove_csrf='.length)) : ''
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = init.method ?? 'GET'
  const response = await fetch(`/api/v1${path}`, {
    ...init,
    credentials: 'same-origin',
    headers: {
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(method !== 'GET' && method !== 'HEAD' ? { 'x-csrf-token': csrfToken() } : {}),
      ...init.headers,
    },
  })
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      code?: string
      details?: unknown
      message?: string
      traceId?: string
    } | null
    throw new ApiClientError(
      payload?.message ?? 'Yêu cầu không thành công.',
      response.status,
      payload?.code ?? null,
      payload?.details ?? null,
      payload?.traceId ?? null,
    )
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

async function downloadFile(path: string) {
  const response = await fetch(`/api/v1${path}`, { credentials: 'same-origin' })
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null
    throw new ApiClientError(payload?.message ?? 'Không thể tải artifact.', response.status)
  }
  const disposition = response.headers.get('content-disposition') ?? ''
  return {
    blob: await response.blob(),
    fileName: disposition.match(/filename="([^"]+)"/)?.[1] ?? 'export.bin',
    sha256: response.headers.get('x-file-sha256'),
  }
}

async function downloadPostFile(path: string, body: unknown) {
  const response = await fetch(`/api/v1${path}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken() },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new ApiClientError('Không thể tải tệp.', response.status)
  return {
    blob: await response.blob(),
    fileName:
      response.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1] ??
      'export.geojson',
    sha256: response.headers.get('x-file-sha256'),
  }
}

export const api = {
  basemapCapabilities: () => request<BasemapCapabilities>('/basemaps'),
  createCaptureDraft: (
    caseId: string,
    input: CreateCaptureDraftRequest,
    idempotencyKey: string,
    deviceId: string,
  ) =>
    request<CaptureDraftMutationResponse>(`/cases/${caseId}/capture-drafts`, {
      method: 'POST',
      body: JSON.stringify(input),
      headers: { 'idempotency-key': idempotencyKey, 'x-device-id': deviceId },
    }),
  listCaptureDrafts: (caseId: string) =>
    request<CaptureDraft[]>(`/cases/${caseId}/capture-drafts?limit=200`),
  getCaptureDraft: (draftId: string) => request<CaptureDraft>(`/capture-drafts/${draftId}`),
  classifyCaptureDraft: (
    draft: CaptureDraft,
    input: ClassifyCaptureDraftRequest,
    idempotencyKey: string,
    deviceId: string,
  ) =>
    request<ClassifyCaptureDraftResponse>(`/capture-drafts/${draft.id}/classify`, {
      method: 'POST',
      body: JSON.stringify(input),
      headers: {
        'idempotency-key': idempotencyKey,
        'if-match': `"${draft.version}"`,
        'x-device-id': deviceId,
      },
    }),
  createCase: (input: CreateCaseRequest) =>
    request<InspectionCase>('/cases', { method: 'POST', body: JSON.stringify(input) }),
  createWorkItem: (caseId: string, input: CreateWorkItemRequest) =>
    request<WorkItem>(`/cases/${caseId}/work-items`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  createWorkType: (input: CreateWorkTypeRequest) =>
    request<WorkType>('/catalog/work-types', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  createSourceQuantity: (workItemId: string, input: CreateSourceQuantityRequest) =>
    request<SourceQuantity>(`/work-items/${workItemId}/source-quantities`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  getComparison: (caseId: string) => request<CaseComparison>(`/cases/${caseId}/comparison`),
  setCaseComparisonThreshold: (caseId: string, input: ComparisonThreshold) =>
    request<ComparisonThreshold>(`/cases/${caseId}/comparison-settings`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  saveComparisonExplanation: (
    sourceId: string,
    explanation: string,
    attachmentId: string | null = null,
  ) =>
    request(`/source-quantities/${sourceId}/explanation`, {
      method: 'PUT',
      body: JSON.stringify({ explanation, attachmentId }),
    }),
  lockCase: (caseId: string, reason: string) =>
    request<{ inspectionCase: InspectionCase }>(`/cases/${caseId}/lock`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  unlockCase: (caseId: string, reason: string) =>
    request<{ inspectionCase: InspectionCase }>(`/cases/${caseId}/unlock`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  exportCase: (caseId: string, format: 'excel' | 'geojson', filters: Record<string, string> = {}) =>
    request<ExportJob>(`/cases/${caseId}/export-jobs/${format === 'excel' ? 'xlsx' : 'geojson'}`, {
      method: 'POST',
      body: JSON.stringify({ filters }),
    }),
  getExportJob: (exportId: string) => request<ExportJob>(`/exports/${exportId}`),
  downloadExport: (exportId: string) => downloadFile(`/exports/${exportId}/download`),
  downloadMeasurementGeoJson: (measurementId: string) =>
    downloadFile(`/measurements/${measurementId}/download.geojson`),
  downloadFilteredGeoJson: (caseId: string, filters: Record<string, string>) =>
    downloadPostFile(`/cases/${caseId}/map-features/download.geojson`, { filters }),
  listMeasurementHistory: (measurementId: string) =>
    request<AuditEvent[]>(`/measurements/${measurementId}/history`),
  createMeasurement: (workItemId: string, input: CreateMeasurementRequest) =>
    request<Measurement>(`/work-items/${workItemId}/measurements`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  confirmMeasurement: (measurementId: string, input: ConfirmMeasurementRequest = {}) =>
    request<Measurement>(`/measurements/${measurementId}/confirm`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  deleteMeasurement: (measurementId: string) =>
    request<void>(`/measurements/${measurementId}`, { method: 'DELETE' }),
  getCaseMapContext: (caseId: string) => request<CaseMapContext>(`/cases/${caseId}/map-context`),
  listAdminAreas: () => request<AdminArea[]>('/admin-areas'),
  listAdminAreaBoundaries: () => request<AdminAreaBoundary[]>('/admin-areas/boundaries'),
  listCases: (cursor?: string) =>
    request<CaseListResponse>(`/cases${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`),
  listDeletedCases: () => request<InspectionCase[]>('/cases/deleted'),
  restoreCase: (caseId: string, reason: string) =>
    request<InspectionCase>(`/cases/${caseId}/restore`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  listMeasurements: (
    workItemId: string,
    options: { bbox?: string; cursor?: string; limit?: number } = {},
  ) => {
    const query = new URLSearchParams()
    if (options.bbox) query.set('bbox', options.bbox)
    if (options.cursor) query.set('cursor', options.cursor)
    if (options.limit) query.set('limit', String(options.limit))
    return request<MeasurementListResponse>(
      `/work-items/${workItemId}/measurements${query.size ? `?${query}` : ''}`,
    )
  },
  listMapFeatures: (
    caseId: string,
    options: {
      bbox?: string
      componentId?: string
      cursor?: string
      geometryKind?: MeasurementGeometryKind
      limit?: number
      managementZoneId?: string
      serviceGroupId?: string
      status?: MeasurementStatus
      workItemId?: string
    } = {},
  ) => {
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(options)) {
      if (value !== undefined && value !== '') query.set(key, String(value))
    }
    return request<MapFeatureListResponse>(
      `/cases/${caseId}/map-features${query.size ? `?${query}` : ''}`,
    )
  },
  listDeletedMeasurements: (workItemId: string) =>
    request<Measurement[]>(`/work-items/${workItemId}/measurements/deleted`),
  restoreMeasurement: (measurementId: string, reason: string) =>
    request<Measurement>(`/measurements/${measurementId}/restore`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  previewGeoJsonImport: (workItemId: string, input: GeoJsonImportRequest) =>
    request<GeoJsonImportPreview>(`/work-items/${workItemId}/imports/geojson/preview`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  commitGeoJsonImport: (workItemId: string, input: GeoJsonImportRequest) =>
    request<GeoJsonImportCommitResponse>(`/work-items/${workItemId}/imports/geojson/commit`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  listAttachments: (workItemId: string) =>
    request<Attachment[]>(`/work-items/${workItemId}/attachments`),
  listDeletedAttachments: (workItemId: string) =>
    request<Attachment[]>(`/work-items/${workItemId}/attachments/deleted`),
  removeAttachment: (attachmentId: string) =>
    request<void>(`/attachments/${attachmentId}`, { method: 'DELETE' }),
  restoreAttachment: (attachmentId: string, reason: string) =>
    request<Attachment>(`/attachments/${attachmentId}/restore`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  listServiceGroups: () => request<ServiceGroup[]>('/catalog/service-groups'),
  listManagementZones: () => request<ManagementZone[]>('/catalog/management-zones'),
  listWorkItems: (caseId: string) => request<WorkItem[]>(`/cases/${caseId}/work-items`),
  listWorkComponents: (workItemId: string) =>
    request<WorkComponent[]>(`/work-items/${workItemId}/components`),
  listWorkTypes: () => request<WorkType[]>('/catalog/work-types'),
  listTreatmentFacilities: () => request<TreatmentFacility[]>('/treatment-facilities'),
  calculateRoute: (input: RouteRequest) =>
    request<RouteCalculation>('/routes/calculate', { method: 'POST', body: JSON.stringify(input) }),
  saveRoute: (workItemId: string, input: SaveTransportRouteRequest) =>
    request<TransportRoute>(`/work-items/${workItemId}/routes`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  recalculateRoute: (routeId: string, reason: string) =>
    request<TransportRoute>(`/routes/${routeId}/recalculate`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  createGpsTrack: (
    workItemId: string,
    input: CreateGpsTrackRequest,
    idempotencyKey: string,
    deviceId: string,
  ) =>
    request<GpsTrackResponse>(`/work-items/${workItemId}/gps-tracks`, {
      method: 'POST',
      body: JSON.stringify(input),
      headers: { 'idempotency-key': idempotencyKey, 'x-device-id': deviceId },
    }),
  createGpsPoint: (
    workItemId: string,
    input: CreateGpsPointRequest,
    idempotencyKey: string,
    deviceId: string,
  ) =>
    request<GpsPointResponse>(`/work-items/${workItemId}/gps-points`, {
      method: 'POST',
      body: JSON.stringify(input),
      headers: { 'idempotency-key': idempotencyKey, 'x-device-id': deviceId },
    }),
  presignAttachment: (input: PresignAttachmentRequest) =>
    request<PresignAttachmentResponse>('/attachments/presign', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  completeAttachment: (attachmentId: string) =>
    request<Attachment>('/attachments/complete', {
      method: 'POST',
      body: JSON.stringify({ attachmentId }),
    }),
  login: (email: string, password: string) =>
    request<SessionResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  session: () => request<SessionResponse>('/auth/session'),
  supersedeMeasurement: (measurementId: string, input: SupersedeMeasurementRequest) =>
    request<Measurement>(`/measurements/${measurementId}/supersede`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
}
