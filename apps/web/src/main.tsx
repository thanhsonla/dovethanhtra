import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './app.js'
import './styles.css'

const root = document.getElementById('root')
if (!root) throw new Error('Không tìm thấy phần tử gốc của ứng dụng.')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js'))
  } else {
    // Tự động hủy đăng ký service worker ở môi trường phát triển để tránh cache giao diện cũ
    void navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        void registration.unregister().then((success) => {
          if (success) {
            console.log('Đã hủy đăng ký service worker ở chế độ dev.')
            window.location.reload()
          }
        })
      }
    })
  }
}
