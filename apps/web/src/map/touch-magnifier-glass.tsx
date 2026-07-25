import { useEffect, useRef } from 'react'

export interface TouchMagnifierGlassProps {
  mapCanvas: HTMLCanvasElement | null
  touchX: number
  touchY: number
  visible: boolean
  snapType?: string | null | undefined
  triggerRepaint?: () => void
}

export function TouchMagnifierGlass(props: TouchMagnifierGlassProps) {
  const { mapCanvas, touchX, touchY, visible, snapType, triggerRepaint } = props
  const loupeCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (!visible || !mapCanvas || !loupeCanvasRef.current) return

    let animFrameId: number

    const renderLoupe = () => {
      const loupeCanvas = loupeCanvasRef.current
      if (!loupeCanvas || !mapCanvas) return

      if (triggerRepaint) {
        triggerRepaint()
      }

      const ctx = loupeCanvas.getContext('2d')
      if (!ctx) return

      const dpr = window.devicePixelRatio || 1
      const sizePx = 140
      const targetWidth = sizePx * dpr
      const targetHeight = sizePx * dpr

      if (loupeCanvas.width !== targetWidth || loupeCanvas.height !== targetHeight) {
        loupeCanvas.width = targetWidth
        loupeCanvas.height = targetHeight
      }

      // Initialize or resize offscreen backup canvas
      if (!offscreenCanvasRef.current) {
        offscreenCanvasRef.current = document.createElement('canvas')
      }
      const offscreen = offscreenCanvasRef.current
      if (mapCanvas.width > 0 && mapCanvas.height > 0) {
        if (offscreen.width !== mapCanvas.width || offscreen.height !== mapCanvas.height) {
          offscreen.width = mapCanvas.width
          offscreen.height = mapCanvas.height
        }
        const offCtx = offscreen.getContext('2d')
        if (offCtx) {
          try {
            offCtx.drawImage(mapCanvas, 0, 0)
          } catch {
            // Ignore canvas draw errors
          }
        }
      }

      const zoomScale = 2.0
      const srcRegionSize = (sizePx / zoomScale) * dpr
      const srcX = touchX * dpr - srcRegionSize / 2
      const srcY = touchY * dpr - srcRegionSize / 2

      ctx.save()
      ctx.clearRect(0, 0, targetWidth, targetHeight)

      // Circular clip boundary
      ctx.beginPath()
      ctx.arc(targetWidth / 2, targetHeight / 2, targetWidth / 2 - 2 * dpr, 0, Math.PI * 2)
      ctx.clip()

      // Dark background fallback behind canvas
      ctx.fillStyle = '#0f172a'
      ctx.fillRect(0, 0, targetWidth, targetHeight)

      // Render 2x zoomed portion from main WebGL map canvas or offscreen backup
      let drawn = false
      try {
        if (mapCanvas.width > 0 && mapCanvas.height > 0) {
          ctx.drawImage(
            mapCanvas,
            srcX,
            srcY,
            srcRegionSize,
            srcRegionSize,
            0,
            0,
            targetWidth,
            targetHeight,
          )
          drawn = true
        }
      } catch {
        // Ignore bounds error
      }

      if (!drawn && offscreen.width > 0 && offscreen.height > 0) {
        try {
          ctx.drawImage(
            offscreen,
            srcX,
            srcY,
            srcRegionSize,
            srcRegionSize,
            0,
            0,
            targetWidth,
            targetHeight,
          )
        } catch {
          // Ignore offscreen bounds error
        }
      }

      // Precision Center Crosshair (+)
      const centerX = targetWidth / 2
      const centerY = targetHeight / 2
      const crossLen = 14 * dpr
      const centerGap = 3 * dpr

      // Contrast shadow stroke
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)'
      ctx.lineWidth = 4 * dpr
      ctx.beginPath()
      ctx.moveTo(centerX - crossLen, centerY)
      ctx.lineTo(centerX - centerGap, centerY)
      ctx.moveTo(centerX + centerGap, centerY)
      ctx.lineTo(centerX + crossLen, centerY)
      ctx.moveTo(centerX, centerY - crossLen)
      ctx.lineTo(centerX, centerY - centerGap)
      ctx.moveTo(centerX, centerY + centerGap)
      ctx.lineTo(centerX, centerY + crossLen)
      ctx.stroke()

      // Active precision stroke (cyan if snapped, red if freeform)
      const accentColor = snapType ? '#38bdf8' : '#ef4444'
      ctx.strokeStyle = accentColor
      ctx.lineWidth = 2 * dpr
      ctx.stroke()

      // Center Precision Point
      ctx.fillStyle = accentColor
      ctx.beginPath()
      ctx.arc(centerX, centerY, 2.5 * dpr, 0, Math.PI * 2)
      ctx.fill()

      ctx.restore()

      animFrameId = requestAnimationFrame(renderLoupe)
    }

    renderLoupe()

    return () => {
      if (animFrameId) cancelAnimationFrame(animFrameId)
    }
  }, [mapCanvas, touchX, touchY, visible, snapType])

  if (!visible) return null

  // Position loupe 145px directly above touch location so finger doesn't obscure view
  const posX = touchX - 70
  const posY = touchY - 148

  return (
    <div
      className="touch-magnifier-glass"
      style={{ left: `${posX}px`, top: `${posY}px` }}
      aria-hidden="true"
    >
      <canvas ref={loupeCanvasRef} className="touch-magnifier-glass__canvas" />
      <div className="touch-magnifier-glass__badge">
        <span>2x</span>
        {snapType && <span className="touch-magnifier-glass__snap">{snapType}</span>}
      </div>
      <div className="touch-magnifier-glass__pointer" />
    </div>
  )
}
