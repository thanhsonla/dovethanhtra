import { useState } from 'react'
import type { Map as MapLibreMap } from 'maplibre-gl'

export function MapLocateControl(props: { map: MapLibreMap | null }) {
  const [isLocating, setIsLocating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLocate = () => {
    if (!props.map) return
    if (!('geolocation' in navigator)) {
      setError('Trình duyệt không hỗ trợ GPS.')
      return
    }

    setIsLocating(true)
    setError(null)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false)
        const { latitude, longitude } = position.coords
        props.map?.flyTo({
          center: [longitude, latitude],
          zoom: 17,
          speed: 1.5,
        })
      },
      (err) => {
        setIsLocating(false)
        setError(err.message || 'Không thể lấy vị trí hiện tại.')
        setTimeout(() => setError(null), 3000)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    )
  }

  return (
    <div className="map-locate-control">
      {error && <div className="map-locate-control__error">{error}</div>}
      <button
        aria-label="Định vị vị trí hiện tại (GPS)"
        className={`button button--secondary map-locate-control__btn ${isLocating ? 'is-locating' : ''}`}
        onClick={handleLocate}
        title="Vị trí của tôi (GPS)"
        type="button"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="3" fill="currentColor" />
          <path
            d="M12 2v3M12 19v3M2 12h3M19 12h3M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14z"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2"
          />
        </svg>
      </button>
    </div>
  )
}
