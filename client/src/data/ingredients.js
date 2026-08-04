// Curated reference list powering manual tagging, conflict detection, and the
// AI-assisted lookup. Strong actives conflict with every other strong active;
// gentle ingredients don't conflict with anything.
export const CURATED_INGREDIENTS = [
  { key: 'retinoid', label: 'Retinoid', group: 'strong-active', fact: 'Helps skin renew itself faster, smoothing texture and fine lines over time — but it can get irritating if you layer it with other strong actives.' },
  { key: 'vitamin-c', label: 'Vitamin C', group: 'strong-active', fact: 'Brightens skin and helps fade dark spots over time — works best on its own, away from retinoids and strong acids.' },
  { key: 'aha-bha', label: 'AHA / BHA', group: 'strong-active', fact: 'Gently dissolves away dead skin for a smoother, brighter look — using more than one type at once raises the risk of irritation.' },
  { key: 'benzoyl-peroxide', label: 'Benzoyl Peroxide', group: 'strong-active', fact: 'Great at clearing up breakouts, but it dries skin out fast and cancels out retinoids if used together.' },
  { key: 'niacinamide', label: 'Niacinamide', group: 'gentle', fact: 'Calms redness and evens out skin tone — plays well with almost everything.' },
  { key: 'hyaluronic-acid', label: 'Hyaluronic Acid', group: 'gentle', fact: 'Pulls moisture into the skin for an instant hydration boost — very unlikely to cause issues with other products.' },
  { key: 'peptides', label: 'Peptides', group: 'gentle', fact: 'Helps skin stay firm and bouncy over time — generally safe to pair with anything else.' },
  { key: 'ceramides', label: 'Ceramides', group: 'gentle', fact: "Rebuilds and protects your skin's natural barrier, helping it hold onto moisture — safe to use alongside actives." },
  { key: 'azelaic-acid', label: 'Azelaic Acid', group: 'gentle', fact: 'Calms redness and smooths out bumpy texture — gentle enough for most people.' },
  { key: 'pdrn', label: 'PDRN', group: 'gentle', fact: 'A repairing ingredient (derived from salmon DNA) that helps skin heal and bounce back — low risk of issues with other products.' },
  { key: 'centella-asiatica', label: 'Centella', group: 'gentle', fact: "Calms redness and irritation while supporting your skin's barrier — very low risk of causing issues with other products." },
]

export function slugify(label) {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}
