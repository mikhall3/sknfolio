// Curated reference list powering manual tagging, conflict detection, and the
// AI-assisted lookup. Strong actives conflict with every other strong active;
// gentle ingredients don't conflict with anything.
export const CURATED_INGREDIENTS = [
  { key: 'retinoid', label: 'Retinoid', group: 'strong-active', fact: 'Speeds up cell turnover — can be irritating when layered with other strong actives.' },
  { key: 'vitamin-c', label: 'Vitamin C', group: 'strong-active', fact: 'A brightening antioxidant — best kept on its own, away from retinoids and strong acids.' },
  { key: 'aha-bha', label: 'AHA / BHA', group: 'strong-active', fact: 'Chemical exfoliants — layering more than one raises the risk of irritation.' },
  { key: 'benzoyl-peroxide', label: 'Benzoyl Peroxide', group: 'strong-active', fact: 'Effective for breakouts, but can deactivate retinoids and dry out skin fast.' },
  { key: 'niacinamide', label: 'Niacinamide', group: 'gentle', fact: 'Soothing and versatile — plays well with almost everything.' },
  { key: 'hyaluronic-acid', label: 'Hyaluronic Acid', group: 'gentle', fact: 'A humectant hydrator with very low conflict risk.' },
  { key: 'peptides', label: 'Peptides', group: 'gentle', fact: 'Supports the skin barrier and firmness — generally low-conflict.' },
  { key: 'ceramides', label: 'Ceramides', group: 'gentle', fact: 'Barrier-supporting lipids — safe to pair with actives.' },
  { key: 'azelaic-acid', label: 'Azelaic Acid', group: 'gentle', fact: 'Calming for redness and texture, generally well-tolerated.' },
  { key: 'pdrn', label: 'PDRN', group: 'gentle', fact: 'A regenerating ingredient derived from salmon DNA — low-conflict.' },
  { key: 'centella-asiatica', label: 'Centella', group: 'gentle', fact: 'Calming for redness and irritation, supports the skin barrier — very low conflict risk.' },
]

export function slugify(label) {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}
