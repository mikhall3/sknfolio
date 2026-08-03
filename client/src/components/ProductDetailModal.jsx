import { useEffect, useState } from 'react'
import { X, Star, Trash2, PackageCheck, Plus, Loader2, Sparkles, RotateCcw, ShieldAlert } from 'lucide-react'
import { CATEGORIES, CATEGORY_MAP, TIME_OF_DAY_OPTIONS } from '../data/categories'
import { CURATED_INGREDIENTS, slugify } from '../data/ingredients'
import { friendlyDate, shortDate, daysBetween } from '../lib/dates'
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
  const [retrying, setRetrying] = useState(false)
  // Once ingredients are found, the manual palette and lookup button are
  // just clutter for something already answered - collapse to a clean list
  // and only bring the full picker back if there's nothing tagged yet, or
  // the user explicitly asks to edit.
  const [editingIngredients, setEditingIngredients] = useState(product?.ingredientTags?.length === 0)

  // The ingredient lookup runs on the server independently of this modal, so
  // poll while it's still going - this is what surfaces "still searching"
  // (or a finished/failed result) even for a lookup someone else's tab started.
  useEffect(() => {
    if (current.ingredientLookupStatus !== 'PENDING') return
    const interval = setInterval(async () => {
      try {
        const { product: fresh } = await api.get(`/products/${current.id}`)
        setCurrent(fresh)
        onUpdated(fresh)
      } catch {
        // transient - try again on the next tick
      }
    }, 3000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.ingredientLookupStatus, current.id])

  if (!product) return null

  async function retryLookup() {
    setRetrying(true)
    setError('')
    try {
      const { jobId } = await api.post('/ingredients/detect', {
        name: current.name,
        brand: current.brand,
        category: current.category,
      })
      await api.post(`/ingredients/detect/${jobId}/attach`, { productId: current.id })
      const { product: fresh } = await api.get(`/products/${current.id}`)
      setCurrent(fresh)
      onUpdated(fresh)
    } catch (err) {
      setError(err.message || 'Could not start that search.')
    } finally {
      setRetrying(false)
    }
  }

  const archived = current.status === 'ARCHIVED'
  const category = CATEGORY_MAP[current.category]
  const CategoryIcon = category?.icon
  const customTags = current.ingredientTags.filter((t) => !CURATED_INGREDIENTS.some((c) => c.key === t.key))
  const hasTags = current.ingredientTags.length > 0
  const showPalette = editingIngredients || !hasTags

  // What's known about each tagged ingredient - a curated fact, a flagged
  // concern, or both. Ingredients with neither stay plain tags above, nothing
  // to explain here.
  const curatedByKey = new Map(CURATED_INGREDIENTS.map((c) => [c.key, c]))
  const learnItems = current.ingredientTags
    .map((t) => ({ key: t.key, label: t.label, fact: curatedByKey.get(t.key)?.fact || null, concern: t.ewgConcern || null }))
    .filter((i) => i.fact || i.concern)

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

              <p className="text-xs text-plum-400 mb-4">
                On your shelf since {shortDate(current.dateAdded)} —{' '}
                <span className="font-semibold text-blush-500">{daysBetween(current.dateAdded)} days</span>
              </p>

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
              <p className="text-[11px] text-plum-400">
                {shortDate(current.dateAdded)} → {shortDate(current.archivedAt)} · lasted{' '}
                <span className="font-semibold text-blush-500">{daysBetween(current.dateAdded, current.archivedAt)} days</span>
              </p>
            </div>
          )}

          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-medium text-plum-500">Ingredients</p>
            {!archived && hasTags && (
              <button
                onClick={() => setEditingIngredients((v) => !v)}
                className="text-xs font-medium text-blush-500 hover:text-blush-700"
              >
                {editingIngredients ? 'Done' : 'Edit'}
              </button>
            )}
          </div>

          {current.ingredientLookupStatus === 'PENDING' && (
            <p className="flex items-center gap-1.5 text-xs text-plum-500 bg-plum-50 border border-plum-100 rounded-xl px-3 py-2 mb-3">
              <Loader2 size={13} className="animate-spin shrink-0" />
              Still searching for the real ingredient list — this can take a minute. Feel free to close this and
              check back; it'll fill in automatically.
            </p>
          )}
          {current.ingredientLookupStatus === 'ERROR' && (
            <div className="flex items-center justify-between gap-2 text-xs text-blush-700 bg-blush-50 border border-blush-200 rounded-xl px-3 py-2 mb-3">
              <span>{current.ingredientLookupError || 'Ingredient search failed.'}</span>
              <button
                onClick={retryLookup}
                disabled={retrying}
                className="flex items-center gap-1 shrink-0 font-medium hover:text-blush-800 disabled:opacity-50"
              >
                {retrying ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                Retry
              </button>
            </div>
          )}

          {showPalette ? (
            <>
              {!archived && current.ingredientLookupStatus !== 'PENDING' && current.ingredientLookupStatus !== 'ERROR' && (
                <button
                  onClick={retryLookup}
                  disabled={retrying}
                  className="flex items-center gap-1.5 rounded-full border border-blush-300 bg-white text-blush-600 text-xs font-medium px-3 py-1.5 mb-3 hover:bg-blush-50 transition-colors disabled:opacity-50"
                >
                  {retrying ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                  {hasTags ? 'Redo ingredient lookup' : 'Look up real ingredients'}
                </button>
              )}

              <div className="flex flex-wrap gap-2 mb-3">
                {CURATED_INGREDIENTS.map((ing) => {
                  const tag = current.ingredientTags.find((t) => t.key === ing.key)
                  const active = Boolean(tag)
                  return (
                    <button
                      key={ing.key}
                      onClick={() => !archived && toggleIngredient(ing)}
                      disabled={archived}
                      title={tag?.ewgConcern ? `Worth knowing: ${tag.ewgConcern}` : undefined}
                      className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        active
                          ? 'border-blush-400 bg-blush-50 text-blush-700'
                          : 'border-plum-100 bg-white text-plum-500 hover:border-blush-200'
                      } ${archived ? 'opacity-70' : ''}`}
                    >
                      {ing.label}
                      {tag?.ewgConcern && <ShieldAlert size={12} className="text-blush-400" />}
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
                    className="rounded-xl bg-blush-50 text-blush-600 px-3 hover:bg-blush-100 transition-colors"
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
                      title={t.ewgConcern ? `Worth knowing: ${t.ewgConcern}` : undefined}
                      className="rounded-full border border-blush-400 bg-blush-50 text-blush-700 px-3 py-1.5 text-xs flex items-center gap-1"
                    >
                      {t.label}
                      {t.ewgConcern && <ShieldAlert size={12} className="text-blush-400" />}
                      {!archived && (
                        <button onClick={() => removeIngredient(t)} className="text-blush-400 hover:text-blush-800">
                          <X size={12} />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-wrap gap-2 mb-5">
              {current.ingredientTags.map((t) => (
                <span
                  key={t.id}
                  title={t.ewgConcern ? `Worth knowing: ${t.ewgConcern}` : undefined}
                  className="rounded-full border border-blush-300 bg-blush-50 text-blush-700 px-3 py-1.5 text-xs font-medium flex items-center gap-1"
                >
                  {t.label}
                  {t.ewgConcern && <ShieldAlert size={12} className="text-blush-500" />}
                  {!archived && (
                    <button onClick={() => removeIngredient(t)} className="text-blush-400 hover:text-blush-800">
                      <X size={12} />
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}

          {(current.ingredientLookupSummary || learnItems.length > 0) && (
            <div className="rounded-xl bg-blush-50/50 border border-blush-100 p-3 mb-5 space-y-2.5">
              <div className="flex items-center gap-1.5">
                <Sparkles size={13} className="text-blush-500 shrink-0" strokeWidth={1.75} />
                <p className="text-xs font-semibold text-plum-800">What's in this</p>
              </div>
              {current.ingredientLookupSummary && (
                <p className="text-xs text-plum-600 leading-relaxed">{current.ingredientLookupSummary}</p>
              )}
              {learnItems.length > 0 && (
                <div className="space-y-1.5">
                  {learnItems.map((i) => (
                    <div key={i.key}>
                      {i.fact && (
                        <div className="flex items-start gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-blush-300 shrink-0 mt-[5px]" />
                          <p className="text-xs leading-relaxed">
                            <span className="font-medium text-plum-800">{i.label}</span>
                            <span className="text-plum-500"> — {i.fact}</span>
                          </p>
                        </div>
                      )}
                      {i.concern && (
                        <div className="flex items-start gap-1.5">
                          <ShieldAlert size={14} className="text-blush-400 shrink-0 mt-px" strokeWidth={2} />
                          <p className="text-xs leading-relaxed">
                            {!i.fact && <span className="font-medium text-plum-800">{i.label} — </span>}
                            <span className="text-blush-600">{i.concern}</span>
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
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
