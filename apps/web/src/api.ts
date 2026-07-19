import type {
  AdminArea,
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
  CreateGpsPointRequest,
  CreateGpsTrackRequest,
  GpsPointResponse,
  GpsTrackResponse,
  PresignAttachmentRequest,
  PresignAttachmentResponse,
} from '@dove/contracts'

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message)
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
    const payload = (await response.json().catch(() => null)) as { message?: string } | null
    throw new ApiClientError(payload?.message ?? 'Yêu cầu không thành công.', response.status)
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

async function requestFile(path: string) {
  const response = await fetch(`/api/v1${path}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'x-csrf-token': csrfToken() },
  })
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null
    throw new ApiClientError(payload?.message ?? 'Không thể tạo tệp xuất.', response.status)
  }
  const disposition = response.headers.get('content-disposition') ?? ''
  return {
    blob: await response.blob(),
    fileName: disposition.match(/filename="([^"]+)"/)?.[1] ?? 'export.bin',
    sha256: response.headers.get('x-file-sha256'),
  }
}

export const api = {
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
  exportCase: (caseId: string, format: 'excel' | 'geojson') =>
    requestFile(`/cases/${caseId}/exports/${format}`),
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
  listCases: () => request<CaseListResponse>('/cases'),
  listMeasurements: (workItemId: string) =>
    request<MeasurementListResponse>(`/work-items/${workItemId}/measurements`),
  listAttachments: (workItemId: string) =>
    request<Attachment[]>(`/work-items/${workItemId}/attachments`),
  listServiceGroups: () => request<ServiceGroup[]>('/catalog/service-groups'),
  listWorkItems: (caseId: string) => request<WorkItem[]>(`/cases/${caseId}/work-items`),
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
