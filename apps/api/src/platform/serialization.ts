export function isoDateTime(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

export function isoDate(value: Date | string): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10)
}
