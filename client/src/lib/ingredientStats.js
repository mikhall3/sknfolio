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
