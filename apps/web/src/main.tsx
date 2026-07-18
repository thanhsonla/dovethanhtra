import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './app.js'
import 'maplibre-gl/dist/maplibre-gl.css'
import './map/map.css'
import './styles.css'

const root = document.getElementById('root')
if (!root) throw new Error('Không tìm thấy phần tử gốc của ứng dụng.')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js'))
}
