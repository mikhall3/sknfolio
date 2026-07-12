import { AlertTriangle, Check } from 'lucide-react'
import { findConflicts, pairKey } from '../lib/ingredientStats'

export default function ConflictBanner({ products, acknowledgedKeys, onAcknowledge }) {
  const pairs = findConflicts(products || []).filter(
    (pair) => !acknowledgedKeys?.has(pairKey(pair.a.key, pair.b.key))
  )
  if (pairs.length === 0) return null

  return (
    <div className="rounded-2xl border border-blush-200 bg-blush-50 p-4 mb-4">
      <div className="flex items-start gap-2.5">
        <AlertTriangle size={16} className="text-blush-600 mt-0.5 shrink-0" strokeWidth={1.75} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-blush-700 mb-1.5">A couple of actives are overlapping</p>
          <div className="space-y-2">
            {pairs.map((pair) => (
              <div key={`${pair.a.key}-${pair.b.key}`} className="flex items-start justify-between gap-2">
                <p className="text-xs text-blush-600 leading-relaxed">
                  <span className="font-medium">
                    {pair.a.label} + {pair.b.label}
                  </span>{' '}
                  — {pair.a.fact} {pair.b.fact}
                </p>
                {onAcknowledge && (
                  <button
                    onClick={() => onAcknowledge(pair.a.key, pair.b.key)}
                    className="shrink-0 flex items-center gap-1 rounded-full border border-blush-300 bg-white text-blush-600 text-[11px] font-medium px-2 py-1 hover:bg-blush-100 transition-colors"
                    title="Got it, don't remind me about this pair again"
                  >
                    <Check size={11} /> Got it
                  </button>
                )}
              </div>
            ))}
          </div>
          <p className="text-[11px] text-blush-400 mt-2">
            Just a heads up, not medical advice — consider alternating days if skin's been reactive.
          </p>
        </div>
      </div>
    </div>
  )
}
