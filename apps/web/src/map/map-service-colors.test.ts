import { describe, expect, it } from 'vitest'
import {
  AREA_SUBTRACTION_COLOR,
  COMMUNE_BOUNDARY_COLORS,
  serviceGroupColor,
} from './map-service-colors.js'

describe('serviceGroupColor', () => {
  it('returns default fallback color for null or empty service group name', () => {
    expect(serviceGroupColor(null)).toBe('#1675a1')
    expect(serviceGroupColor(undefined)).toBe('#1675a1')
    expect(serviceGroupColor('')).toBe('#1675a1')
  })

  it('maps service group names to correct standard colors', () => {
    expect(serviceGroupColor('Công tác Cây xanh đô thị')).toBe('#10b981')
    expect(serviceGroupColor('Dịch vụ Vệ sinh môi trường')).toBe('#3b82f6')
    expect(serviceGroupColor('Hệ thống Chiếu sáng công cộng')).toBe('#f59e0b')
    expect(serviceGroupColor('Quản lý Thoát nước')).toBe('#8b5cf6')
  })

  it('maps service group names to high-contrast neon colors in sun mode', () => {
    expect(serviceGroupColor('Công tác Cây xanh đô thị', 'sun')).toBe('#00ff66')
    expect(serviceGroupColor('Dịch vụ Vệ sinh môi trường', 'sun')).toBe('#00ffff')
    expect(serviceGroupColor('Hệ thống Chiếu sáng công cộng', 'sun')).toBe('#ffff00')
    expect(serviceGroupColor(null, 'sun')).toBe('#00ffff')
  })

  it('maps service group names to soft glow colors in night mode', () => {
    expect(serviceGroupColor('Công tác Cây xanh đô thị', 'night')).toBe('#34d399')
    expect(serviceGroupColor('Dịch vụ Vệ sinh môi trường', 'night')).toBe('#38bdf8')
    expect(serviceGroupColor('Hệ thống Chiếu sáng công cộng', 'night')).toBe('#facc15')
    expect(serviceGroupColor(null, 'night')).toBe('#38bdf8')
  })

  it('keeps boundaries and subtraction areas visually separate from drawing tools', () => {
    expect(COMMUNE_BOUNDARY_COLORS).toEqual({
      label: '#665d50',
      line: '#a99a83',
    })
    expect(AREA_SUBTRACTION_COLOR).toBe('#b05a78')
    expect(Object.values(COMMUNE_BOUNDARY_COLORS)).not.toContain(AREA_SUBTRACTION_COLOR)
  })
})
