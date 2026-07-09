const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/

export function parseDateOnly(str) {
  if (!DATE_ONLY_RE.test(String(str))) return null
  const date = new Date(`${str}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatDateOnly(date) {
  return date.toISOString().slice(0, 10)
}

export function startOfWeek(date) {
  const d = new Date(date)
  const day = d.getUTCDay()
  const diff = (day === 0 ? -6 : 1) - day
  d.setUTCDate(d.getUTCDate() + diff)
  return d
}
