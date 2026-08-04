import { useState } from 'react'
import { X, Loader2, Check } from 'lucide-react'
import { ABNORMALITY_TYPES } from '../data/insights'
import { api } from '../lib/api'
import { friendlyDate } from '../lib/dates'
import { productsAddedNear } from '../lib/productCorrelation'
import { productLabel } from '../lib/productLabel'

export default function AbnormalityModal({ open, date, products, onClose, onLogged }) {
  const [type, setType] = useState(null)
  const [severity, setSeverity] = useState(0)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  if (!open) return null

  const nearby = productsAddedNear(date, products)

  function reset() {
    setType(null)
    setSeverity(0)
    setNote('')
    setError('')
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleSubmit() {
    if (!type || !severity) {
      setError('Pick a type and a severity first.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const { abnormality } = await api.post('/abnormalities', { type, severity, note: note.trim(), date })
      onLogged(abnormality)
      handleClose()
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
          <h2 className="font-display text-2xl font-semibold text-plum-900">What's showing up?</h2>
          <button onClick={handleClose} className="text-plum-400 hover:text-plum-700">
            <X size={19} />
          </button>
        </div>

        <div className="px-6 pb-2 overflow-y-auto flex-1">
          <p className="text-sm text-plum-500 mb-5">Tracking for {friendlyDate(date).toLowerCase()}.</p>

          {nearby.length > 0 && (
            <p className="text-xs text-blush-600 bg-blush-50 border border-blush-200 rounded-xl px-3 py-2 mb-5 leading-relaxed">
              Added not long before: {nearby.map(({ product }) => productLabel(product)).join(', ')} — worth a
              mention in the note if it seems related.
            </p>
          )}

          <p className="text-xs font-medium text-plum-500 mb-2">Type</p>
          <div className="flex flex-wrap gap-2 mb-5">
            {ABNORMALITY_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setType(t.value)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  type === t.value
                    ? 'border-blush-400 bg-blush-50 text-blush-700'
                    : 'border-plum-100 bg-white text-plum-500 hover:border-blush-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <p className="text-xs font-medium text-plum-500 mb-2">How noticeable, 1-5?</p>
          <div className="flex gap-1.5 mb-5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setSeverity(n)}
                className={`w-9 h-9 rounded-full border text-sm font-medium transition-colors ${
                  severity === n
                    ? 'border-blush-400 bg-blush-500 text-white'
                    : 'border-plum-100 bg-white text-plum-500 hover:border-blush-200'
                }`}
              >
                {n}
              </button>
            ))}
          </div>

          <p className="text-xs font-medium text-plum-500 mb-2">Notes (optional)</p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Where, since when, anything that might have triggered it..."
            rows={3}
            className="w-full rounded-xl border border-plum-200 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blush-300 focus:border-transparent resize-none mb-2"
          />

          {error && (
            <p className="text-xs text-blush-700 bg-blush-50 border border-blush-200 rounded-xl px-3 py-2 mt-2">
              {error}
            </p>
          )}
        </div>

        <div className="flex justify-end px-6 py-4 border-t border-blush-100">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-full bg-blush-500 text-white text-sm font-medium px-5 py-2.5 hover:bg-blush-600 transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
