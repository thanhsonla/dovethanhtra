import type {
  AdminArea,
  CaseMapContext,
  CaseListResponse,
  CreateCaseRequest,
  CreateWorkTypeRequest,
  CreateWorkItemRequest,
  InspectionCase,
  Measurement,
  MeasurementListResponse,
  CreateMeasurementRequest,
  ConfirmMeasurementRequest,
  SupersedeMeasurementRequest,
  ServiceGroup,
  SessionResponse,
  WorkItem,
  WorkType,
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
  listServiceGroups: () => request<ServiceGroup[]>('/catalog/service-groups'),
  listWorkItems: (caseId: string) => request<WorkItem[]>(`/cases/${caseId}/work-items`),
  listWorkTypes: () => request<WorkType[]>('/catalog/work-types'),
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
