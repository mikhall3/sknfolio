// Curated reference list for ingredient tagging. Conflict rules and AI-assisted
// detection land in a later stage — for now this just powers manual tagging.
export const CURATED_INGREDIENTS = [
  { key: 'retinoid', label: 'Retinoid', group: 'strong-active' },
  { key: 'vitamin-c', label: 'Vitamin C', group: 'strong-active' },
  { key: 'aha-bha', label: 'AHA / BHA', group: 'strong-active' },
  { key: 'benzoyl-peroxide', label: 'Benzoyl Peroxide', group: 'strong-active' },
  { key: 'niacinamide', label: 'Niacinamide', group: 'gentle' },
  { key: 'hyaluronic-acid', label: 'Hyaluronic Acid', group: 'gentle' },
  { key: 'peptides', label: 'Peptides', group: 'gentle' },
  { key: 'ceramides', label: 'Ceramides', group: 'gentle' },
  { key: 'azelaic-acid', label: 'Azelaic Acid', group: 'gentle' },
  { key: 'pdrn', label: 'PDRN', group: 'gentle' },
]

export function slugify(label) {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}
