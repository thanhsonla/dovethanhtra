const SERVICE_GROUP_COLORS: Record<string, string> = {
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

export function serviceGroupColor(serviceGroupName?: string | null): string {
  if (!serviceGroupName) return '#1675a1'
  const normalized = serviceGroupName.toLowerCase()
  for (const [key, color] of Object.entries(SERVICE_GROUP_COLORS)) {
    if (normalized.includes(key)) return color
  }
  return '#1675a1'
}
