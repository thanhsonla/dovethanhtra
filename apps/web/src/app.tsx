import type {
  AdminArea,
  InspectionCase,
  ServiceGroup,
  SessionResponse,
  WorkItem,
  WorkType,
} from '@dove/contracts'
import { lazy, Suspense, type FormEvent, useEffect, useState } from 'react'

import { api, ApiClientError } from './api.js'
import { CaseDetail } from './case-detail.js'
import { CatalogPanel } from './catalog-panel.js'
import { ComparisonPanel } from './comparison-panel.js'
import { CreateCaseForm } from './create-case-form.js'

const MapWorkspace = lazy(() =>
  import('./map/map-workspace.js').then((module) => ({ default: module.MapWorkspace })),
)

interface WorkspaceData {
  adminAreas: AdminArea[]
  cases: InspectionCase[]
  groups: ServiceGroup[]
  workTypes: WorkType[]
}

const emptyData: WorkspaceData = { adminAreas: [], cases: [], groups: [], workTypes: [] }
const legacyCaseDashboard = import.meta.env.VITE_LEGACY_CASE_DASHBOARD === 'true'
let internalCaseCreation: Promise<InspectionCase> | null = null

const statusLabel: Record<InspectionCase['status'], string> = {
  archived: 'Lưu trữ',
  draft: 'Nháp',
  in_progress: 'Đang thực hiện',
  locked: 'Đã khóa',
  review: 'Chờ rà soát',
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'Có lỗi chưa xác định.'
}

function field(values: FormData, name: string): string {
  const value = values.get(name)
  return typeof value === 'string' ? value : ''
}

export function App() {
  const [session, setSession] = useState<SessionResponse | null>(null)
  const [checking, setChecking] = useState(true)
  const [data, setData] = useState<WorkspaceData>(emptyData)
  const [selected, setSelected] = useState<InspectionCase | null>(null)
  const [workItems, setWorkItems] = useState<WorkItem[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [showDeleted, setShowDeleted] = useState(false)
  const [deletedCases, setDeletedCases] = useState<InspectionCase[]>([])
  const [restoreReason, setRestoreReason] = useState('Phục hồi theo yêu cầu người dùng')
  const [caseCursor, setCaseCursor] = useState<string | null>(null)
  const [mapOpen, setMapOpen] = useState(
    () =>
      !legacyCaseDashboard ||
      (typeof window !== 'undefined' && window.location.hash !== '#dashboard'),
  )
  const [error, setError] = useState('')

  const loadWorkspace = async () => {
    const [adminAreas, caseResponse, groups, workTypes] = await Promise.all([
      api.listAdminAreas(),
      api.listCases(),
      api.listServiceGroups(),
      api.listWorkTypes(),
    ])
    let cases = caseResponse.items
    let defaultCase = cases[0]
    if (!legacyCaseDashboard && !defaultCase) {
      const adminArea = adminAreas[0]
      if (!adminArea) throw new Error('Chưa có địa bàn để khởi tạo không gian bản đồ.')
      const year = new Date().getFullYear()
      internalCaseCreation ??= api.createCase({
        adminAreaId: adminArea.id,
        caseCode: `MAP-${Date.now().toString(36).toUpperCase()}`,
        description: 'Không gian nội bộ tự động cho giao diện bản đồ.',
        name: 'Dữ liệu hiện trường',
        periodEnd: `${year}-12-31`,
        periodStart: `${year}-01-01`,
      })
      defaultCase = await internalCaseCreation
      cases = [defaultCase]
    }
    setData({ adminAreas, cases, groups, workTypes })
    setCaseCursor(caseResponse.nextCursor)
    if (defaultCase) {
      setSelected(defaultCase)
      if (!legacyCaseDashboard || window.location.hash !== '#dashboard') {
        if (!legacyCaseDashboard) window.history.replaceState(null, '', '#map')
        setMapOpen(true)
      }
      try {
        setWorkItems(await api.listWorkItems(defaultCase.id))
      } catch (reason) {
        setError(message(reason))
      }
    }
  }

  useEffect(() => {
    void api
      .session()
      .then(async (current) => {
        setSession(current)
        await loadWorkspace()
      })
      .catch((reason: unknown) => {
        if (!(reason instanceof ApiClientError) || reason.status !== 401) setError(message(reason))
      })
      .finally(() => setChecking(false))
  }, [])

  const selectCase = async (item: InspectionCase) => {
    setSelected(item)
    window.location.hash = '#dashboard'
    setMapOpen(false)
    setError('')
    try {
      setWorkItems(await api.listWorkItems(item.id))
    } catch (reason) {
      setError(message(reason))
    }
  }

  if (checking)
    return (
      <main className="center-card" role="status">
        Đang mở không gian làm việc…
      </main>
    )
  if (!session) {
    return (
      <Login
        error={error}
        onLogin={async (email, password) => {
          setError('')
          try {
            const current = await api.login(email, password)
            setSession(current)
            await loadWorkspace()
            if (!legacyCaseDashboard || window.location.hash !== '#dashboard') {
              setMapOpen(true)
            }
          } catch (reason) {
            setError(message(reason))
          }
        }}
      />
    )
  }

  if (mapOpen && selected) {
    return (
      <Suspense
        fallback={
          <main className="map-loading" role="status">
            Đang tải mô-đun bản đồ…
          </main>
        }
      >
        <MapWorkspace
          groups={data.groups}
          inspectionCase={selected}
          {...(legacyCaseDashboard
            ? {
                onBack: () => {
                  window.location.hash = '#dashboard'
                  setMapOpen(false)
                },
              }
            : {})}
          onWorkCreated={(created) => setWorkItems((items) => [...items, created])}
          onWorkChanged={(updated) =>
            setWorkItems((items) => items.map((item) => (item.id === updated.id ? updated : item)))
          }
          workItems={workItems}
          workTypes={data.workTypes}
        />
      </Suspense>
    )
  }

  if (!legacyCaseDashboard) {
    return (
      <main className="center-card" role={error ? 'alert' : 'status'}>
        {error || 'Đang chuẩn bị dữ liệu bản đồ…'}
      </main>
    )
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Mốc 5 · Đối chiếu và xuất</p>
          <h1>Kiểm tra khối lượng hiện trường</h1>
        </div>
        <div className="account">
          <span>{session.user.displayName}</span>
          <button
            className="button button--quiet"
            onClick={() => void api.logout().finally(() => setSession(null))}
          >
            Đăng xuất
          </button>
        </div>
      </header>

      {error && (
        <div className="alert" role="alert">
          <span>{error}</span>
          <button
            className="button button--quiet"
            onClick={() =>
              void Promise.all([
                loadWorkspace(),
                selected ? api.listWorkItems(selected.id).then(setWorkItems) : Promise.resolve(),
              ])
                .then(() => setError(''))
                .catch((reason) => setError(message(reason)))
            }
          >
            Nạp lại dữ liệu
          </button>
        </div>
      )}

      <main className="workspace">
        <section className="panel case-panel" aria-labelledby="cases-title">
          <div className="panel-heading">
            <div>
              <p className="section-kicker">Không gian công việc</p>
              <h2 id="cases-title">Hồ sơ kiểm tra</h2>
            </div>
            <div className="panel-actions">
              <button
                className="button button--quiet"
                onClick={() => {
                  const next = !showDeleted
                  setShowDeleted(next)
                  if (next)
                    void api
                      .listDeletedCases()
                      .then(setDeletedCases)
                      .catch((reason) => setError(message(reason)))
                }}
              >
                {showDeleted ? 'Ẩn đã xóa' : 'Hồ sơ đã xóa'}
              </button>
              <button
                className="button"
                onClick={() => {
                  setError('')
                  setShowCreate((value) => !value)
                }}
              >
                {showCreate ? 'Đóng' : 'Tạo hồ sơ'}
              </button>
            </div>
          </div>

          {showCreate && (
            <CreateCaseForm
              areas={data.adminAreas}
              cases={data.cases}
              onCreated={async (created) => {
                setData((current) => ({ ...current, cases: [created, ...current.cases] }))
                setShowCreate(false)
                await selectCase(created)
              }}
              onError={setError}
            />
          )}

          {showDeleted && (
            <section className="deleted-records" aria-label="Hồ sơ đã xóa mềm">
              <label>
                Lý do phục hồi
                <input
                  value={restoreReason}
                  onChange={(event) => setRestoreReason(event.target.value)}
                />
              </label>
              {deletedCases.length === 0 && <p className="empty">Không có hồ sơ đã xóa.</p>}
              {deletedCases.map((item) => (
                <div className="deleted-record" key={item.id}>
                  <span>
                    <strong>{item.name}</strong>
                    <small>{item.caseCode}</small>
                  </span>
                  <button
                    className="button button--quiet"
                    disabled={restoreReason.trim().length < 3}
                    onClick={() =>
                      void api
                        .restoreCase(item.id, restoreReason)
                        .then((restored) => {
                          setDeletedCases((current) =>
                            current.filter((entry) => entry.id !== item.id),
                          )
                          setData((current) => ({
                            ...current,
                            cases: [restored, ...current.cases],
                          }))
                        })
                        .catch((reason) => setError(message(reason)))
                    }
                  >
                    Phục hồi
                  </button>
                </div>
              ))}
            </section>
          )}

          <div className="case-list">
            {data.cases.length === 0 && (
              <div className="empty-state">
                <svg
                  className="empty-state__icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
                  />
                </svg>
                <h3 className="empty-state__title">Chưa có hồ sơ</h3>
                <p className="empty-state__description">
                  Hãy tạo hồ sơ kiểm tra đầu tiên để bắt đầu công việc khảo sát và đo đạc khối lượng
                  hiện trường.
                </p>
                <button
                  className="button"
                  onClick={() => {
                    setError('')
                    setShowCreate(true)
                  }}
                >
                  Tạo hồ sơ đầu tiên
                </button>
              </div>
            )}
            {data.cases.map((item) => (
              <button
                className={`case-row ${selected?.id === item.id ? 'case-row--selected' : ''}`}
                key={item.id}
                onClick={() => void selectCase(item)}
              >
                <span className="case-row__main">
                  <strong>{item.name}</strong>
                  <small>
                    {item.caseCode} · {item.adminAreaName}
                  </small>
                </span>
                <span className="case-row__meta">
                  <span className={`badge badge--${item.status}`}>{statusLabel[item.status]}</span>
                  <small>{item.workItemCount} công tác</small>
                </span>
              </button>
            ))}
          </div>
          {caseCursor && (
            <button
              className="button button--quiet load-more"
              onClick={() =>
                void api
                  .listCases(caseCursor)
                  .then((page) => {
                    setData((current) => ({ ...current, cases: [...current.cases, ...page.items] }))
                    setCaseCursor(page.nextCursor)
                  })
                  .catch((reason) => setError(message(reason)))
              }
            >
              Nạp thêm hồ sơ
            </button>
          )}
        </section>

        <aside className="side-column">
          <CaseDetail
            item={selected}
            workItems={workItems}
            workTypes={data.workTypes}
            onCreated={(created) => setWorkItems((items) => [...items, created])}
            onError={setError}
            onOpenMap={() => {
              sessionStorage.setItem('defaultView', 'map')
              setMapOpen(true)
            }}
          />
          {selected && (
            <ComparisonPanel
              inspectionCase={selected}
              workItems={workItems}
              onError={setError}
              onCaseChanged={(changed) => {
                setSelected(changed)
                setData((current) => ({
                  ...current,
                  cases: current.cases.map((item) => (item.id === changed.id ? changed : item)),
                }))
              }}
            />
          )}
          <CatalogPanel
            groups={data.groups}
            onCreated={(created) =>
              setData((current) => ({ ...current, workTypes: [...current.workTypes, created] }))
            }
            onError={setError}
            role={session.user.role}
            workTypes={data.workTypes}
          />
        </aside>
      </main>
    </div>
  )
}

function Login(props: { error: string; onLogin(email: string, password: string): Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    setBusy(true)
    await props.onLogin(field(values, 'email'), field(values, 'password'))
    setBusy(false)
  }
  return (
    <main className="login-page">
      <form className="login-card" onSubmit={(event) => void submit(event)}>
        <p className="eyebrow">Dove hiện trường</p>
        <h1>Đăng nhập</h1>
        <p className="intro">Quản lý hồ sơ kiểm tra và danh mục công tác có phiên bản.</p>
        {props.error && (
          <div className="alert" role="alert">
            {props.error}
          </div>
        )}
        <label>
          Email
          <input name="email" type="email" required autoComplete="username" />
        </label>
        <label>
          Mật khẩu
          <input name="password" type="password" required autoComplete="current-password" />
        </label>
        <button className="button" disabled={busy}>
          {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </button>
      </form>
    </main>
  )
}
