// Products added shortly before a tracked skin issue are worth a second
// look - not proof of anything, just a nudge, since only a product added
// *before* the issue could plausibly be the cause. Same window covers
// currently-active and already-archived products alike, since a product
// could easily have been retired since the issue was logged.
export function productsAddedNear(dateStr, products, windowDays = 14) {
  const target = new Date(dateStr)
  return (products || [])
    .map((product) => {
      const diffDays = Math.round((target - new Date(product.dateAdded)) / 86400000)
      return { product, diffDays }
    })
    .filter(({ diffDays }) => diffDays >= 0 && diffDays <= windowDays)
    .sort((a, b) => a.diffDays - b.diffDays)
}
