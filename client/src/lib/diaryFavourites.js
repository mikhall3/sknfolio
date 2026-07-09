import { api } from './api'
import { localDateString } from './dates'

// A favourite "logs itself daily without re-entry" — the moment one is added,
// stamp it into today's diary immediately rather than waiting for a visit to
// the Diary tab. Past days are never touched, only the current local day.
export async function logFavouriteToday(product) {
  if (!product.favourite) return
  const date = localDateString()
  const periods = product.timeOfDay === 'BOTH' ? ['AM', 'PM'] : [product.timeOfDay]
  await Promise.all(periods.map((period) => api.post(`/diary/${date}/log`, { productId: product.id, period })))
}
