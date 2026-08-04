export function localDateString(d = new Date()) {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function addDays(dateStr, delta) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + delta)
  return localDateString(date)
}

// Compact absolute date for things like "added" / "finished" timestamps,
// where relative wording (Today/Yesterday) would be more confusing than
// helpful once a product's been sitting on the shelf for a while.
export function shortDate(isoOrDateStr) {
  return new Date(isoOrDateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function daysBetween(startIso, endIso) {
  const start = new Date(startIso)
  const end = endIso ? new Date(endIso) : new Date()
  return Math.max(0, Math.round((end - start) / 86400000))
}

export function pluralDays(n) {
  return `${n} day${n === 1 ? '' : 's'}`
}

export function friendlyDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const today = localDateString()
  const yesterday = addDays(today, -1)
  const tomorrow = addDays(today, 1)

  if (dateStr === today) return 'Today'
  if (dateStr === yesterday) return 'Yesterday'
  if (dateStr === tomorrow) return 'Tomorrow'

  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
}
