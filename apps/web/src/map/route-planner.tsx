import type {
  GeoJsonGeometry,
  Measurement,
  RouteCalculation,
  RoutePosition,
  RouteRequest,
  TreatmentFacility,
  TransportRoute,
  WorkItem,
} from '@dove/contracts'
import { type FormEvent, useState } from 'react'

import { api } from '../api.js'

function number(values: FormData, name: string): number {
  return Number(values.get(name))
}

function text(values: FormData, name: string): string {
  const value = values.get(name)
  return typeof value === 'string' ? value : ''
}

function waypoints(value: FormDataEntryValue | null): RoutePosition[] {
  if (typeof value !== 'string' || !value.trim()) return []
  return value
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [lng, lat] = line.split(',').map(Number)
      if (!Number.isFinite(lng) || !Number.isFinite(lat))
        throw new Error('Waypoint phải có dạng kinh độ,vĩ độ; mỗi điểm một dòng.')
      return [lng!, lat!] as RoutePosition
    })
}

const statusLabels: Record<string, string> = {
  confirmed: 'Đã xác nhận',
  draft: 'Nháp',
  needs_attention: 'Cần chú ý',
  pending_validation: 'Chờ kiểm tra',
  superseded: 'Đã thay thế',
}

export function RoutePlanner(props: {
  facilities: TreatmentFacility[]
  measurement: Measurement | null
  onError(value: string): void
  onPreview(value: GeoJsonGeometry | null): void
  onSaved(value: TransportRoute): Promise<void>
  workItem: WorkItem
}) {
  const [calculation, setCalculation] = useState<RouteCalculation | null>(null)
  const [routeRequest, setRouteRequest] = useState<RouteRequest | null>(null)
  const [candidateIndex, setCandidateIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const [savedRoute, setSavedRoute] = useState<TransportRoute | null>(null)

  const calculate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    const facility = props.facilities.find((item) => item.id === values.get('facilityId'))
    if (!facility) return props.onError('Hãy chọn cơ sở xử lý.')
    const request: RouteRequest = {
      origin: [number(values, 'originLng'), number(values, 'originLat')],
      destination: facility.location,
      waypoints: waypoints(values.get('waypoints')),
      profile: values.get('profile') === 'driving-traffic' ? 'driving-traffic' : 'driving',
      alternatives: true,
    }
    try {
      setBusy(true)
      const result = await api.calculateRoute(request)
      setRouteRequest(request)
      setCalculation(result)
      setCandidateIndex(0)
      props.onPreview(result.candidates[0]?.geometry ?? null)
    } catch (reason) {
      props.onError(reason instanceof Error ? reason.message : 'Không thể tính route.')
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    if (!routeRequest || !calculation) return
    const form = document.querySelector<HTMLFormElement>('#route-plan-form')
    if (!form) return
    const values = new FormData(form)
    try {
      setBusy(true)
      const result = await api.saveRoute(props.workItem.id, {
        name: text(values, 'name') || 'Lộ trình vận chuyển',
        request: routeRequest,
        candidateIndex,
        treatmentFacilityId: text(values, 'facilityId'),
        returnFactor: number(values, 'returnFactor'),
        tripCount: number(values, 'tripCount'),
        ...(text(values, 'weightTon') === ''
          ? {}
          : { transportedWeightTon: number(values, 'weightTon') }),
        note: text(values, 'note') || null,
      })
      setSavedRoute(result)
      props.onPreview(null)
      await props.onSaved(result)
    } catch (reason) {
      props.onError(reason instanceof Error ? reason.message : 'Không thể lưu route.')
    } finally {
      setBusy(false)
    }
  }

  const routeId =
    savedRoute?.id ??
    (typeof props.measurement?.calculationOutput.routeId === 'string'
      ? props.measurement.calculationOutput.routeId
      : null)
  const recalculate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!routeId) return
    const values = new FormData(event.currentTarget)
    try {
      setBusy(true)
      const result = await api.recalculateRoute(routeId, text(values, 'reason'))
      setSavedRoute(result)
      await props.onSaved(result)
    } catch (reason) {
      props.onError(reason instanceof Error ? reason.message : 'Không thể tính lại route.')
    } finally {
      setBusy(false)
    }
  }

  const currentMeasurement = savedRoute?.measurement ?? props.measurement

  return (
    <div className="route-planner">
      <p className="section-kicker">Mốc 3 · Route vận chuyển</p>
      <h2>{props.workItem.name}</h2>
      {currentMeasurement && (
        <p className="route-status-summary" style={{ margin: '0.5rem 0 1rem' }}>
          <strong>
            v{currentMeasurement.version} ·{' '}
            {statusLabels[currentMeasurement.status] ?? currentMeasurement.status}
          </strong>
        </p>
      )}
      <form id="route-plan-form" onSubmit={(event) => void calculate(event)}>
        <label>
          Tên route
          <input name="name" defaultValue="Lộ trình đến cơ sở xử lý" required />
        </label>
        <div className="route-grid">
          <label>
            Kinh độ đầu
            <input name="originLng" type="number" step="any" defaultValue="104.65" required />
          </label>
          <label>
            Vĩ độ đầu
            <input name="originLat" type="number" step="any" defaultValue="20.80" required />
          </label>
        </div>
        <label>
          Cơ sở xử lý
          <select name="facilityId" required defaultValue="">
            <option value="" disabled>
              Chọn cơ sở
            </option>
            {props.facilities.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Waypoint (kinh độ,vĩ độ; mỗi dòng một điểm)
          <textarea name="waypoints" rows={3} />
        </label>
        <label>
          Profile
          <select name="profile">
            <option value="driving">Lái xe</option>
            <option value="driving-traffic">Lái xe có giao thông</option>
          </select>
        </label>
        <div className="route-grid">
          <label>
            Hệ số chiều về
            <input name="returnFactor" type="number" min="0" step="any" defaultValue="2" required />
          </label>
          <label>
            Số lượt
            <input name="tripCount" type="number" min="0" step="any" defaultValue="1" required />
          </label>
        </div>
        <label>
          Khối lượng (tấn, nếu công thức yêu cầu)
          <input name="weightTon" type="number" min="0" step="any" />
        </label>
        <label>
          Ghi chú
          <textarea name="note" rows={2} />
        </label>
        <button className="button" disabled={busy} type="submit">
          {busy ? 'Đang xử lý…' : 'Tính phương án'}
        </button>
      </form>
      {calculation && (
        <div className="route-candidates">
          <p>
            Nguồn cự ly: <strong>{calculation.provider}</strong>
          </p>
          {calculation.candidates.map((item, index) => (
            <label key={index}>
              <input
                type="radio"
                name="candidate"
                checked={candidateIndex === index}
                onChange={() => {
                  setCandidateIndex(index)
                  props.onPreview(item.geometry)
                }}
              />
              Phương án {index + 1}: {(item.distanceM / 1000).toFixed(3)} km · {item.legs.length}{' '}
              chặng
            </label>
          ))}
          <button className="button" disabled={busy} onClick={() => void save()}>
            Lưu route chính thức
          </button>
        </div>
      )}
      {routeId && (
        <form className="supersede-form" onSubmit={(event) => void recalculate(event)}>
          <label>
            Lý do tính lại
            <input name="reason" minLength={3} required />
          </label>
          <button className="button" disabled={busy} type="submit">
            Tính lại thành phiên bản mới
          </button>
        </form>
      )}
    </div>
  )
}
