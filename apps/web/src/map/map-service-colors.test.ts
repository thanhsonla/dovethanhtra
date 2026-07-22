import { describe, expect, it } from 'vitest'
import { serviceGroupColor } from './map-service-colors.js'

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
})
