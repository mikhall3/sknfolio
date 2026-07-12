import { useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { findConflicts } from '../lib/ingredientStats'

// Scoped to only what's actually logged today (not the whole shelf), and
// dismissible per visit - re-mounted with a key={date} by the parent so it
// resets when you move to a different day instead of staying hidden forever.
export default function DiaryConflictBanner({ products }) {
  const [dismissed, setDismissed] = useState(false)
  const pairs = findConflicts(products || [])
  if (dismissed || pairs.length === 0) return null

  return (
    <div className="rounded-2xl border border-blush-200 bg-blush-50 p-4 mb-4">
      <div className="flex items-start gap-2.5">
        <AlertTriangle size={16} className="text-blush-600 mt-0.5 shrink-0" strokeWidth={1.75} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-blush-700 mb-1.5">A couple of actives are overlapping today</p>
          <div className="space-y-1.5">
            {pairs.map((pair, i) => (
              <p key={i} className="text-xs text-blush-600 leading-relaxed">
                <span className="font-medium">
                  {pair.a.label} + {pair.b.label}
                </span>{' '}
                — {pair.a.fact} {pair.b.fact}
              </p>
            ))}
          </div>
          <p className="text-[11px] text-blush-400 mt-2">
            Just a heads up, not medical advice — consider alternating today if skin's been reactive.
          </p>
        </div>
        <button onClick={() => setDismissed(true)} className="text-blush-400 hover:text-blush-700 shrink-0">
          <X size={15} />
        </button>
      </div>
    </div>
  )
}
