export type FieldDisplayMode = 'normal' | 'sun' | 'night'

export const COMMUNE_BOUNDARY_COLORS = {
  label: '#665d50',
  line: '#a99a83',
} as const

export const AREA_SUBTRACTION_COLOR = '#b05a78'

const SERVICE_GROUP_COLORS_NORMAL: Record<string, string> = {
  'cây xanh': '#10b981', // Green
  'vệ sinh': '#3b82f6', // Blue
  'rác thải': '#3b82f6', // Blue
  'môi trường': '#06b6d4', // Cyan
  'chiếu sáng': '#f59e0b', // Amber/Yellow
  'đèn chiếu': '#f59e0b', // Amber
  'thoát nước': '#8b5cf6', // Purple
  'sông suối': '#6366f1', // Indigo
  'đường phố': '#ec4899', // Pink
  'địa chính': '#64748b', // Slate
}

// High-Contrast Neon Phản quang Palette for Outdoor Sun Mode
const SERVICE_GROUP_COLORS_SUN: Record<string, string> = {
  'cây xanh': '#00ff66', // Neon Lime Green
  'vệ sinh': '#00ffff', // Neon Cyan
  'rác thải': '#00ffff', // Neon Cyan
  'môi trường': '#00f0ff', // Bright Cyan
  'chiếu sáng': '#ffff00', // Neon Yellow
  'đèn chiếu': '#ffff00', // Neon Yellow
  'thoát nước': '#ff00ff', // Neon Magenta / Fuchsia
  'sông suối': '#8000ff', // Neon Purple
  'đường phố': '#ff007f', // Neon Pink
  'địa chính': '#ffffff', // High Contrast White
}

// Phosphorescent Night Glow Palette for Dark Glass Night Mode
const SERVICE_GROUP_COLORS_NIGHT: Record<string, string> = {
  'cây xanh': '#34d399', // Soft Emerald Glow
  'vệ sinh': '#38bdf8', // Soft Cyan Glow
  'rác thải': '#38bdf8', // Soft Cyan Glow
  'môi trường': '#22d3ee', // Soft Turquoise Glow
  'chiếu sáng': '#facc15', // Soft Amber Glow
  'đèn chiếu': '#facc15', // Soft Amber Glow
  'thoát nước': '#c084fc', // Soft Purple Glow
  'sông suối': '#818cf8', // Soft Indigo Glow
  'đường phố': '#f472b6', // Soft Pink Glow
  'địa chính': '#94a3b8', // Soft Slate
}

export function serviceGroupColor(
  serviceGroupName?: string | null,
  fieldMode: FieldDisplayMode = 'normal',
): string {
  const fallback = fieldMode === 'sun' ? '#00ffff' : fieldMode === 'night' ? '#38bdf8' : '#1675a1'
  if (!serviceGroupName) return fallback
  const normalized = serviceGroupName.toLowerCase()
  const table =
    fieldMode === 'sun'
      ? SERVICE_GROUP_COLORS_SUN
      : fieldMode === 'night'
        ? SERVICE_GROUP_COLORS_NIGHT
        : SERVICE_GROUP_COLORS_NORMAL

  for (const [key, color] of Object.entries(table)) {
    if (normalized.includes(key)) return color
  }
  return fallback
}
