import { useState } from 'react'
import { X, Star, Loader2, RefreshCw, Shuffle, Archive } from 'lucide-react'
import { api } from '../lib/api'

const ACTIONS = [
  {
    value: 'rebuy',
    label: 'Rebuy',
    description: 'Loved it — start a fresh bottle right away.',
    icon: RefreshCw,
  },
  {
    value: 'replace',
    label: 'Replace',
    description: "Done with this one — I'll try something new instead.",
    icon: Shuffle,
  },
  {
    value: 'retire',
    label: 'Retire',
    description: 'Just archive it, no replacement for now.',
    icon: Archive,
  },
]

export default function EmptyProductModal({ open, product, onClose, onDone }) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  if (!open || !product) return null

  function reset() {
    setRating(0)
    setComment('')
    setError('')
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleAction(action) {
    if (!rating) {
      setError('Give it a rating first.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await api.post(`/products/${product.id}/empty`, { rating, comment: comment.trim(), action })
      onDone({ action, ...res })
      reset()
    } catch (err) {
      setError(err.message || 'Could not save this.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-30 bg-plum-900/40 backdrop-blur-[2px] flex items-end sm:items-center justify-center">
      <div className="bg-cream-50 w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[88vh] flex flex-col">
        <div className="flex items-center justify-between px-6 pt-5 pb-1">
          <h2 className="font-display text-2xl font-semibold text-plum-900">All done with it?</h2>
          <button onClick={handleClose} className="text-plum-400 hover:text-plum-700">
            <X size={19} />
          </button>
        </div>

        <div className="px-6 pb-2 overflow-y-auto flex-1">
          <p className="text-sm text-plum-500 mb-5">{product.name}</p>

          <p className="text-xs font-medium text-plum-500 mb-2">How was it, out of 5?</p>
          <div className="flex gap-1.5 mb-5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setRating(n)} className="text-blush-400">
                <Star size={26} fill={n <= rating ? 'currentColor' : 'none'} strokeWidth={1.5} />
              </button>
            ))}
          </div>

          <p className="text-xs font-medium text-plum-500 mb-2">Any final thoughts? (optional)</p>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Worth repurchasing? Broke you out? Just meh?"
            rows={3}
            className="w-full rounded-xl border border-plum-200 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blush-300 focus:border-transparent resize-none mb-5"
          />

          {error && (
            <p className="text-xs text-blush-700 bg-blush-50 border border-blush-200 rounded-xl px-3 py-2 mb-4">
              {error}
            </p>
          )}

          <div className="space-y-2 mb-2">
            {ACTIONS.map(({ value, label, description, icon: Icon }) => (
              <button
                key={value}
                onClick={() => handleAction(value)}
                disabled={saving || !rating}
                className="w-full flex items-center gap-3 rounded-2xl border border-plum-100 bg-white px-4 py-3 text-left hover:border-blush-300 hover:bg-blush-50 transition-colors disabled:opacity-40"
              >
                <div className="w-8 h-8 rounded-xl bg-blush-50 text-blush-500 flex items-center justify-center shrink-0">
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <Icon size={15} strokeWidth={1.75} />}
                </div>
                <div>
                  <p className="text-sm font-medium text-plum-900">{label}</p>
                  <p className="text-xs text-plum-400">{description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
