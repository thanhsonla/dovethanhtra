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
  const [mapOpen, setMapOpen] = useState(false)
  const [error, setError] = useState('')

  const loadWorkspace = async () => {
    const [adminAreas, caseResponse, groups, workTypes] = await Promise.all([
      api.listAdminAreas(),
      api.listCases(),
      api.listServiceGroups(),
      api.listWorkTypes(),
    ])
    setData({ adminAreas, cases: caseResponse.items, groups, workTypes })
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
          onBack={() => setMapOpen(false)}
          workItems={workItems}
          workTypes={data.workTypes}
        />
      </Suspense>
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
          {error}
        </div>
      )}

      <main className="workspace">
        <section className="panel case-panel" aria-labelledby="cases-title">
          <div className="panel-heading">
            <div>
              <p className="section-kicker">Không gian công việc</p>
              <h2 id="cases-title">Hồ sơ kiểm tra</h2>
            </div>
            <button className="button" onClick={() => setShowCreate((value) => !value)}>
              {showCreate ? 'Đóng' : 'Tạo hồ sơ'}
            </button>
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

          <div className="case-list">
            {data.cases.length === 0 && (
              <p className="empty">Chưa có hồ sơ. Hãy tạo hồ sơ đầu tiên.</p>
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
        </section>

        <aside className="side-column">
          <CaseDetail
            item={selected}
            workItems={workItems}
            workTypes={data.workTypes}
            onCreated={(created) => setWorkItems((items) => [...items, created])}
            onError={setError}
            onOpenMap={() => setMapOpen(true)}
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
