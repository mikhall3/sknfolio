import { useState } from 'react'
import { X, Star, Trash2, PackageCheck, Plus, Loader2 } from 'lucide-react'
import { CATEGORIES, CATEGORY_MAP, FILL_LEVELS, SIZE_TYPES, TIME_OF_DAY_OPTIONS } from '../data/categories'
import { CURATED_INGREDIENTS, slugify } from '../data/ingredients'
import { friendlyDate } from '../lib/dates'
import { api } from '../lib/api'

const RETIRE_LABEL = { REBOUGHT: 'Rebought', REPLACED: 'Replaced', RETIRED: 'Retired' }

export default function ProductDetailModal({ product, onClose, onUpdated, onMarkEmpty, onDeleted }) {
  const [current, setCurrent] = useState(product)
  const [brandDraft, setBrandDraft] = useState(product?.brand || '')
  const [nameDraft, setNameDraft] = useState(product?.name || '')
  const [freeform, setFreeform] = useState('')
  const [noteDraft, setNoteDraft] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [error, setError] = useState('')

  if (!product) return null

  const archived = current.status === 'ARCHIVED'
  const category = CATEGORY_MAP[current.category]
  const CategoryIcon = category?.icon
  const customTags = current.ingredientTags.filter((t) => !CURATED_INGREDIENTS.some((c) => c.key === t.key))

  async function patch(fields) {
    setError('')
    try {
      const { product: updated } = await api.patch(`/products/${current.id}`, fields)
      setCurrent(updated)
      onUpdated(updated)
    } catch (err) {
      setError(err.message || 'Could not save that change.')
    }
  }

  async function saveBrandName() {
    const cleanName = nameDraft.trim()
    if (!cleanName) {
      setNameDraft(current.name)
      return
    }
    if (cleanName === current.name && brandDraft.trim() === (current.brand || '')) return
    await patch({ name: cleanName, brand: brandDraft.trim() })
  }

  async function addIngredient(tag) {
    setError('')
    try {
      const { ingredientTag } = await api.post(`/products/${current.id}/ingredients`, tag)
      const updated = { ...current, ingredientTags: [...current.ingredientTags, ingredientTag] }
      setCurrent(updated)
      onUpdated(updated)
    } catch (err) {
      setError(err.message || 'Could not tag that ingredient.')
    }
  }

  async function removeIngredient(tag) {
    setError('')
    try {
      await api.delete(`/products/${current.id}/ingredients/${tag.id}`)
      const updated = { ...current, ingredientTags: current.ingredientTags.filter((t) => t.id !== tag.id) }
      setCurrent(updated)
      onUpdated(updated)
    } catch (err) {
      setError(err.message || 'Could not remove that ingredient.')
    }
  }

  function toggleIngredient(ing) {
    const existingTag = current.ingredientTags.find((t) => t.key === ing.key)
    if (existingTag) removeIngredient(existingTag)
    else addIngredient({ key: ing.key, label: ing.label, source: 'manual' })
  }

  function addFreeformIngredient() {
    const label = freeform.trim()
    if (!label) return
    const key = slugify(label)
    if (!key || current.ingredientTags.some((t) => t.key === key)) {
      setFreeform('')
      return
    }
    addIngredient({ key, label, source: 'manual' })
    setFreeform('')
  }

  async function submitNote() {
    const text = noteDraft.trim()
    if (!text) return
    setSavingNote(true)
    try {
      const { note } = await api.post(`/products/${current.id}/notes`, { text })
      const updated = { ...current, notes: [note, ...(current.notes || [])] }
      setCurrent(updated)
      onUpdated(updated)
      setNoteDraft('')
    } catch (err) {
      setError(err.message || 'Could not save that note.')
    } finally {
      setSavingNote(false)
    }
  }

  async function handleDelete() {
    await api.delete(`/products/${current.id}`)
    onDeleted(current.id)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-30 bg-plum-900/40 backdrop-blur-[2px] flex items-end sm:items-center justify-center">
      <div className="bg-cream-50 w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[88vh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2 min-w-0">
            {CategoryIcon && <CategoryIcon size={18} className="text-blush-500 shrink-0" strokeWidth={1.75} />}
            <span className="text-xs font-medium text-plum-400 uppercase tracking-wide truncate">
              {category?.label}
            </span>
          </div>
          <button onClick={onClose} className="text-plum-400 hover:text-plum-700 shrink-0">
            <X size={19} />
          </button>
        </div>

        <div className="px-6 pb-5 overflow-y-auto flex-1">
          <label className="text-xs font-medium text-plum-500 mb-1 block">Brand</label>
          <input
            value={brandDraft}
            onChange={(e) => setBrandDraft(e.target.value)}
            onBlur={saveBrandName}
            disabled={archived}
            placeholder="Brand"
            className="w-full rounded-xl border border-plum-200 bg-white px-3.5 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blush-300 focus:border-transparent disabled:opacity-60 disabled:bg-plum-50"
          />
          <label className="text-xs font-medium text-plum-500 mb-1 block">Product name</label>
          <input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={saveBrandName}
            disabled={archived}
            className="w-full rounded-xl border border-plum-200 bg-white px-3.5 py-2 text-sm font-medium mb-4 focus:outline-none focus:ring-2 focus:ring-blush-300 focus:border-transparent disabled:opacity-60 disabled:bg-plum-50"
          />

          {!archived && (
            <>
              <p className="text-xs font-medium text-plum-500 mb-1.5">Category</p>
              <select
                value={current.category}
                onChange={(e) => patch({ category: e.target.value })}
                className="w-full rounded-xl border border-plum-200 bg-white px-3.5 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blush-300"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>

              <p className="text-xs font-medium text-plum-500 mb-1.5">When do you use it?</p>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {TIME_OF_DAY_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => patch({ timeOfDay: value })}
                    className={`rounded-xl border px-2 py-2 text-xs font-medium transition-colors ${
                      current.timeOfDay === value
                        ? 'border-blush-400 bg-blush-50 text-blush-700'
                        : 'border-plum-100 bg-white text-plum-500 hover:border-blush-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <p className="text-xs font-medium text-plum-500 mb-1.5">How full is it?</p>
              <div className="grid grid-cols-4 gap-1.5 mb-2">
                {FILL_LEVELS.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => patch({ fillLevel: value, sizeType: null })}
                    className={`rounded-xl border px-1.5 py-2 text-xs font-medium transition-colors ${
                      current.fillLevel === value && !current.sizeType
                        ? 'border-blush-400 bg-blush-50 text-blush-700'
                        : 'border-plum-100 bg-white text-plum-500 hover:border-blush-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-1.5 mb-4">
                {SIZE_TYPES.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => patch({ sizeType: value, fillLevel: 100 })}
                    className={`rounded-xl border px-2 py-2 text-xs font-medium transition-colors ${
                      current.sizeType === value
                        ? 'border-blush-400 bg-blush-50 text-blush-700'
                        : 'border-plum-100 bg-white text-plum-500 hover:border-blush-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <button
                onClick={() => patch({ favourite: !current.favourite })}
                className={`w-full flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium mb-5 transition-colors ${
                  current.favourite
                    ? 'border-blush-400 bg-blush-50 text-blush-700'
                    : 'border-plum-100 bg-white text-plum-500 hover:border-blush-200'
                }`}
              >
                <Star size={14} fill={current.favourite ? 'currentColor' : 'none'} strokeWidth={1.75} />
                {current.favourite ? 'Daily staple' : 'Mark as daily staple'}
              </button>
            </>
          )}

          {archived && (
            <div className="rounded-xl bg-white border border-plum-100 p-3 mb-4 space-y-1.5">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    size={13}
                    className="text-blush-400"
                    fill={n <= (current.emptyRating || 0) ? 'currentColor' : 'none'}
                    strokeWidth={1.5}
                  />
                ))}
                <span className="text-xs text-plum-400 ml-1">{RETIRE_LABEL[current.retireReason]}</span>
              </div>
              {current.emptyComment && (
                <p className="text-xs text-plum-500 italic leading-snug">"{current.emptyComment}"</p>
              )}
            </div>
          )}

          <p className="text-xs font-medium text-plum-500 mb-1.5">Ingredients</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {CURATED_INGREDIENTS.map((ing) => {
              const active = current.ingredientTags.some((t) => t.key === ing.key)
              return (
                <button
                  key={ing.key}
                  onClick={() => !archived && toggleIngredient(ing)}
                  disabled={archived}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? 'border-blush-400 bg-blush-50 text-blush-700'
                      : 'border-plum-100 bg-white text-plum-500 hover:border-blush-200'
                  } ${archived ? 'opacity-70' : ''}`}
                >
                  {ing.label}
                </button>
              )
            })}
          </div>
          {!archived && (
            <div className="flex gap-2 mb-3">
              <input
                value={freeform}
                onChange={(e) => setFreeform(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addFreeformIngredient())}
                placeholder="Add another ingredient"
                className="flex-1 rounded-xl border border-plum-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blush-300 focus:border-transparent"
              />
              <button
                onClick={addFreeformIngredient}
                className="rounded-xl bg-plum-100 text-plum-600 px-3 hover:bg-plum-200 transition-colors"
              >
                <Plus size={16} />
              </button>
            </div>
          )}
          {customTags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-5">
              {customTags.map((t) => (
                <span
                  key={t.id}
                  className="rounded-full bg-plum-50 border border-plum-200 text-plum-600 px-3 py-1.5 text-xs flex items-center gap-1"
                >
                  {t.label}
                  {!archived && (
                    <button onClick={() => removeIngredient(t)} className="text-plum-400 hover:text-plum-700">
                      <X size={12} />
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}

          <p className="text-xs font-medium text-plum-500 mb-1.5">Notes</p>
          {(current.notes || []).length > 0 && (
            <div className="space-y-2 mb-3 max-h-36 overflow-y-auto">
              {current.notes.map((note) => (
                <div key={note.id} className="text-xs bg-white border border-plum-100 rounded-xl px-3 py-2">
                  <span className="text-plum-300 text-[10px]">{friendlyDate(note.date.slice(0, 10))}</span>
                  <p className="text-plum-600 leading-snug">{note.text}</p>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), submitNote())}
              placeholder="How's it working out?"
              className="flex-1 rounded-xl border border-plum-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blush-300 focus:border-transparent"
            />
            <button
              onClick={submitNote}
              disabled={savingNote || !noteDraft.trim()}
              className="rounded-xl bg-plum-100 text-plum-600 px-3 hover:bg-plum-200 transition-colors disabled:opacity-50"
            >
              {savingNote ? <Loader2 size={14} className="animate-spin" /> : <Plus size={16} />}
            </button>
          </div>

          {error && (
            <p className="text-xs text-blush-700 bg-blush-50 border border-blush-200 rounded-xl px-3 py-2 mt-3">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-blush-100">
          {confirmingDelete ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-plum-400">Remove for good?</span>
              <button onClick={handleDelete} className="text-blush-600 font-medium">
                Yes
              </button>
              <button onClick={() => setConfirmingDelete(false)} className="text-plum-400">
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmingDelete(true)}
              className="flex items-center gap-1.5 text-xs text-plum-400 hover:text-blush-600"
            >
              <Trash2 size={14} /> Delete
            </button>
          )}

          {!archived && (
            <button
              onClick={() => onMarkEmpty(current)}
              className="flex items-center gap-1.5 rounded-full bg-blush-500 text-white text-sm font-medium px-4 py-2.5 hover:bg-blush-600 transition-colors"
            >
              <PackageCheck size={15} /> Mark as empty
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
