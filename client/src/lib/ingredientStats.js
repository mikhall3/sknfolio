import { CURATED_INGREDIENTS } from '../data/ingredients'

const STRONG_ACTIVES = new Map(CURATED_INGREDIENTS.filter((i) => i.group === 'strong-active').map((i) => [i.key, i]))

// Two distinct strong actives both currently in rotation is the conflict signal —
// using the same active twice isn't a conflict, so we key by distinct ingredient.
export function findConflicts(products) {
  const byKey = new Map()
  for (const product of products) {
    if (product.status !== 'ACTIVE') continue
    for (const tag of product.ingredientTags || []) {
      if (!STRONG_ACTIVES.has(tag.key)) continue
      if (!byKey.has(tag.key)) byKey.set(tag.key, [])
      byKey.get(tag.key).push(product)
    }
  }

  const keys = [...byKey.keys()]
  const pairs = []
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      pairs.push({
        a: STRONG_ACTIVES.get(keys[i]),
        b: STRONG_ACTIVES.get(keys[j]),
        productsA: byKey.get(keys[i]),
        productsB: byKey.get(keys[j]),
      })
    }
  }
  return pairs
}

// Checks a set of ingredient keys (e.g. from a product being added) against
// what's already active on the shelf, so a conflict can be flagged before the
// product is even saved - not just once both are logged on the same day.
export function findShelfConflicts(newKeys, existingProducts) {
  const newStrong = [...new Set(newKeys)].filter((k) => STRONG_ACTIVES.has(k))
  if (newStrong.length === 0) return []

  const results = []
  for (const product of existingProducts || []) {
    if (product.status !== 'ACTIVE') continue
    const existingKeys = [
      ...new Set((product.ingredientTags || []).map((t) => t.key).filter((k) => STRONG_ACTIVES.has(k))),
    ].filter((k) => !newStrong.includes(k))
    if (existingKeys.length === 0) continue
    results.push({
      product,
      newIngredients: newStrong.map((k) => STRONG_ACTIVES.get(k)),
      existingIngredients: existingKeys.map((k) => STRONG_ACTIVES.get(k)),
    })
  }
  return results
}

export function commonIngredients(products) {
  const counts = new Map()
  for (const product of products) {
    if (product.status !== 'ACTIVE') continue
    for (const tag of product.ingredientTags || []) {
      const entry = counts.get(tag.key) || { key: tag.key, label: tag.label, count: 0 }
      entry.count += 1
      counts.set(tag.key, entry)
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count)
}
