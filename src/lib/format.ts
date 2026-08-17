export function toMillis(value: unknown): number | null {
  if (value && typeof value === 'object' && 'toMillis' in (value as object)) {
    return (value as { toMillis: () => number }).toMillis()
  }
  if (typeof value === 'number') return value
  return null
}

export function formatDate(value: unknown): string {
  const millis = toMillis(value)
  if (millis == null) return ''
  const d = new Date(millis)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}
