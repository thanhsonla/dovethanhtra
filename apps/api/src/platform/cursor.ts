import { AppError } from './app-error.js'

export interface TimeCursor {
  id: string
  timestamp: string
}

export function encodeCursor(cursor: TimeCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url')
}

export function decodeCursor(value: string | undefined): TimeCursor | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof (parsed as TimeCursor).id !== 'string' ||
      typeof (parsed as TimeCursor).timestamp !== 'string' ||
      !Number.isFinite(Date.parse((parsed as TimeCursor).timestamp))
    ) {
      throw new Error('invalid cursor')
    }
    return parsed as TimeCursor
  } catch {
    throw new AppError(400, 'CURSOR_INVALID', 'Cursor phân trang không hợp lệ.')
  }
}
