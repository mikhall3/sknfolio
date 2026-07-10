import { useMemo, useState } from 'react'
import { X, ChevronLeft, ChevronRight, Check, Loader2, Plus, Sparkles, AlertTriangle } from 'lucide-react'
import { CATEGORIES, FILL_LEVELS, SIZE_TYPES, TIME_OF_DAY_OPTIONS } from '../data/categories'
import { CURATED_INGREDIENTS, slugify } from '../data/ingredients'
import { findShelfConflicts } from '../lib/ingredientStats'
import { productLabel } from '../lib/productLabel'
import { api } from '../lib/api'

const CONFIDENCE_STYLE = {
  HIGH: 'border-blush-200 bg-blush-50 text-blush-700',
  MEDIUM: 'border-plum-200 bg-cream-200 text-plum-600',
  LOW: 'border-plum-300 bg-plum-50 text-plum-700',
}
const CONFIDENCE_LABEL = {
  HIGH: 'High confidence — found this product directly',
  MEDIUM: 'Medium confidence — a close match, worth double-checking',
  LOW: 'Low confidence — please verify against the label',
}

const STEPS = ['category', 'name', 'fill', 'timing', 'regular', 'ingredients']

export default function AddProductModal({
  open,
  onClose,
  onCreated,
  defaultTimeOfDay,
  defaultCategory,
  existingProducts,
}) {
  const [stepIndex, setStepIndex] = useState(0)
  const [form, setForm] = useState({
    category: defaultCategory || null,
    brand: '',
    name: '',
    fillLevel: 100,
    sizeType: null,
    timeOfDay: defaultTimeOfDay || null,
    favourite: null,
    ingredients: [],
  })
  const [freeform, setFreeform] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [lookupStatus, setLookupStatus] = useState('idle')
  const [lookupResult, setLookupResult] = useState(null)
  const [lookupError, setLookupError] = useState('')

  const shelfConflicts = useMemo(
    () => findShelfConflicts(form.ingredients.map((i) => i.key), existingProducts),
    [form.ingredients, existingProducts]
  )

  if (!open) return null

  const step = STEPS[stepIndex]
  const isLast = stepIndex === STEPS.length - 1

  function canAdvance() {
    if (step === 'category') return Boolean(form.category)
    if (step === 'name') return form.name.trim().length > 0
    if (step === 'fill') return true
    if (step === 'timing') return Boolean(form.timeOfDay)
    if (step === 'regular') return form.favourite !== null
    return true
  }

  function toggleIngredient(ing) {
    setForm((f) => {
      const exists = f.ingredients.some((i) => i.key === ing.key)
      return {
        ...f,
        ingredients: exists
          ? f.ingredients.filter((i) => i.key !== ing.key)
          : [...f.ingredients, { key: ing.key, label: ing.label, source: 'manual' }],
      }
    })
  }

  function addFreeformIngredient() {
    const label = freeform.trim()
    if (!label) return
    const key = slugify(label)
    if (!key || form.ingredients.some((i) => i.key === key)) {
      setFreeform('')
      return
    }
    setForm((f) => ({ ...f, ingredients: [...f.ingredients, { key, label, source: 'manual' }] }))
    setFreeform('')
  }

  function reset() {
    setStepIndex(0)
    setForm({
      category: defaultCategory || null,
      brand: '',
      name: '',
      fillLevel: 100,
      sizeType: null,
      timeOfDay: defaultTimeOfDay || null,
      favourite: null,
      ingredients: [],
    })
    setFreeform('')
    setError('')
    setLookupStatus('idle')
    setLookupResult(null)
    setLookupError('')
  }

  async function handleLookup() {
    setLookupStatus('loading')
    setLookupError('')
    try {
      const result = await api.post('/ingredients/detect', {
        name: form.name,
        brand: form.brand,
        category: form.category,
      })
      setLookupResult(result)
      setForm((f) => {
        const existingKeys = new Set(f.ingredients.map((i) => i.key))
        const additions = (result.ingredients || [])
          .map((ing) => {
            const key = ing.key || slugify(ing.label)
            if (!key || existingKeys.has(key)) return null
            existingKeys.add(key)
            return { key, label: ing.label, confidence: result.confidence, source: 'ai' }
          })
          .filter(Boolean)
        return { ...f, ingredients: [...f.ingredients, ...additions] }
      })
      setLookupStatus('done')
    } catch (err) {
      setLookupError(err.message || 'Could not look this up.')
      setLookupStatus('error')
    }
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleSubmit() {
    setSaving(true)
    setError('')
    try {
      const { product } = await api.post('/products', {
        name: form.name.trim(),
        brand: form.brand.trim(),
        category: form.category,
        fillLevel: form.fillLevel,
        sizeType: form.sizeType,
        timeOfDay: form.timeOfDay,
        favourite: form.favourite,
        ingredients: form.ingredients,
      })
      onCreated(product)
      handleClose()
    } catch (err) {
      setError(err.message || 'Could not save this product.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-30 bg-plum-900/40 backdrop-blur-[2px] flex items-end sm:items-center justify-center">
      <div className="bg-cream-50 w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[88vh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex gap-1.5">
            {STEPS.map((s, i) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all ${
                  i === stepIndex ? 'w-6 bg-blush-500' : i < stepIndex ? 'w-1.5 bg-blush-300' : 'w-1.5 bg-plum-100'
                }`}
              />
            ))}
          </div>
          <button onClick={handleClose} className="text-plum-400 hover:text-plum-700">
            <X size={19} />
          </button>
        </div>

        <div className="px-6 pb-4 overflow-y-auto flex-1">
          {step === 'category' && (
            <div>
              <h2 className="font-display text-2xl font-semibold mb-1">What kind of product?</h2>
              <p className="text-sm text-plum-500 mb-5">Pick the category it lives in.</p>
              <div className="grid grid-cols-3 gap-2.5">
                {CATEGORIES.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => setForm((f) => ({ ...f, category: value }))}
                    className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 py-3.5 text-center transition-colors ${
                      form.category === value
                        ? 'border-blush-400 bg-blush-50 text-blush-700'
                        : 'border-plum-100 bg-white text-plum-500 hover:border-blush-200'
                    }`}
                  >
                    <Icon size={20} strokeWidth={1.75} />
                    <span className="text-[11px] leading-tight">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 'name' && (
            <div>
              <h2 className="font-display text-2xl font-semibold mb-1">What's it called?</h2>
              <p className="text-sm text-plum-500 mb-5">
                Splitting brand and product name helps ingredient lookup find the exact product.
              </p>
              <label className="text-xs font-medium text-plum-500 mb-1 block">Brand</label>
              <input
                autoFocus
                value={form.brand}
                onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
                placeholder="e.g. Rhode"
                className="w-full rounded-xl border border-plum-200 bg-white px-3.5 py-2.5 text-sm mb-3.5 focus:outline-none focus:ring-2 focus:ring-blush-300 focus:border-transparent"
              />
              <label className="text-xs font-medium text-plum-500 mb-1 block">Product name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Milky Toner"
                className="w-full rounded-xl border border-plum-200 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blush-300 focus:border-transparent"
              />
            </div>
          )}

          {step === 'fill' && (
            <div>
              <h2 className="font-display text-2xl font-semibold mb-1">How full is it?</h2>
              <p className="text-sm text-plum-500 mb-5">
                If it's already open, this keeps "time to empty" accurate.
              </p>
              <div className="grid grid-cols-2 gap-2.5 mb-2.5">
                {FILL_LEVELS.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setForm((f) => ({ ...f, fillLevel: value, sizeType: null }))}
                    className={`rounded-2xl border px-4 py-3 text-sm font-medium transition-colors ${
                      form.fillLevel === value && !form.sizeType
                        ? 'border-blush-400 bg-blush-50 text-blush-700'
                        : 'border-plum-100 bg-white text-plum-500 hover:border-blush-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-plum-400 mb-2">Or, if it's not a regular full-size product:</p>
              <div className="grid grid-cols-2 gap-2.5">
                {SIZE_TYPES.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setForm((f) => ({ ...f, sizeType: value, fillLevel: 100 }))}
                    className={`rounded-2xl border px-4 py-3 text-sm font-medium transition-colors ${
                      form.sizeType === value
                        ? 'border-blush-400 bg-blush-50 text-blush-700'
                        : 'border-plum-100 bg-white text-plum-500 hover:border-blush-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 'timing' && (
            <div>
              <h2 className="font-display text-2xl font-semibold mb-1">When do you use it?</h2>
              <p className="text-sm text-plum-500 mb-5">This decides where it shows up in your diary.</p>
              <div className="grid grid-cols-3 gap-2.5">
                {TIME_OF_DAY_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setForm((f) => ({ ...f, timeOfDay: value }))}
                    className={`rounded-2xl border px-3 py-3 text-sm font-medium transition-colors ${
                      form.timeOfDay === value
                        ? 'border-blush-400 bg-blush-50 text-blush-700'
                        : 'border-plum-100 bg-white text-plum-500 hover:border-blush-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 'regular' && (
            <div>
              <h2 className="font-display text-2xl font-semibold mb-1">Used regularly?</h2>
              <p className="text-sm text-plum-500 mb-5">
                We'll favourite it and log it for you daily, so you don't have to re-enter it every time.
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={() => setForm((f) => ({ ...f, favourite: true }))}
                  className={`rounded-2xl border px-4 py-3 text-sm font-medium transition-colors ${
                    form.favourite === true
                      ? 'border-blush-400 bg-blush-50 text-blush-700'
                      : 'border-plum-100 bg-white text-plum-500 hover:border-blush-200'
                  }`}
                >
                  Yes, daily staple
                </button>
                <button
                  onClick={() => setForm((f) => ({ ...f, favourite: false }))}
                  className={`rounded-2xl border px-4 py-3 text-sm font-medium transition-colors ${
                    form.favourite === false
                      ? 'border-blush-400 bg-blush-50 text-blush-700'
                      : 'border-plum-100 bg-white text-plum-500 hover:border-blush-200'
                  }`}
                >
                  Not really
                </button>
              </div>
            </div>
          )}

          {step === 'ingredients' && (
            <div>
              <h2 className="font-display text-2xl font-semibold mb-1">Tag its ingredients</h2>
              <p className="text-sm text-plum-500 mb-3">Optional — helps us flag conflicts later.</p>

              <button
                onClick={handleLookup}
                disabled={lookupStatus === 'loading' || !form.name.trim()}
                className="flex items-center gap-1.5 rounded-full border border-plum-200 bg-white text-plum-600 text-xs font-medium px-3 py-1.5 mb-3 hover:border-blush-300 hover:text-blush-600 transition-colors disabled:opacity-50"
              >
                {lookupStatus === 'loading' ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Sparkles size={13} />
                )}
                Look up real ingredients
              </button>

              {lookupError && (
                <p className="text-xs text-blush-700 bg-blush-50 border border-blush-200 rounded-xl px-3 py-2 mb-3">
                  {lookupError}
                </p>
              )}

              {shelfConflicts.length > 0 && (
                <div className="rounded-xl border border-blush-200 bg-blush-50 p-3 mb-3 text-xs text-blush-700">
                  <p className="font-medium mb-1.5 flex items-center gap-1.5">
                    <AlertTriangle size={12} />
                    Might not pair well with what's already on your shelf
                  </p>
                  <div className="space-y-1.5">
                    {shelfConflicts.map((c) => (
                      <p key={c.product.id} className="leading-relaxed">
                        <span className="font-medium">{productLabel(c.product)}</span> has{' '}
                        {c.existingIngredients.map((i) => i.label).join(', ')} — layering{' '}
                        {c.newIngredients.map((i) => i.label).join(', ')} on top can raise the risk of irritation.
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {lookupResult && (
                <div className={`rounded-xl border p-3 mb-4 text-xs ${CONFIDENCE_STYLE[lookupResult.confidence]}`}>
                  <p className="font-medium mb-1 flex items-center gap-1.5">
                    {lookupResult.confidence === 'LOW' && <AlertTriangle size={12} />}
                    {CONFIDENCE_LABEL[lookupResult.confidence]}
                  </p>
                  <p className="leading-relaxed">{lookupResult.summary}</p>
                  <p className="text-[11px] opacity-70 mt-1.5">
                    Smart guidance, not medical advice — always check the actual label.
                  </p>
                </div>
              )}

              <div className="flex flex-wrap gap-2 mb-4">
                {CURATED_INGREDIENTS.map((ing) => {
                  const active = form.ingredients.some((i) => i.key === ing.key)
                  return (
                    <button
                      key={ing.key}
                      onClick={() => toggleIngredient(ing)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        active
                          ? 'border-blush-400 bg-blush-50 text-blush-700'
                          : 'border-plum-100 bg-white text-plum-500 hover:border-blush-200'
                      }`}
                    >
                      {ing.label}
                    </button>
                  )
                })}
              </div>
              <div className="flex gap-2">
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
              {form.ingredients.filter((i) => i.source === 'manual' && !CURATED_INGREDIENTS.some((c) => c.key === i.key))
                .length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {form.ingredients
                    .filter((i) => !CURATED_INGREDIENTS.some((c) => c.key === i.key))
                    .map((i) => (
                      <span
                        key={i.key}
                        className="rounded-full bg-plum-50 border border-plum-200 text-plum-600 px-3 py-1.5 text-xs flex items-center gap-1"
                      >
                        {i.label}
                        <button onClick={() => toggleIngredient(i)} className="text-plum-400 hover:text-plum-700">
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                </div>
              )}
            </div>
          )}

          {error && <p className="text-xs text-blush-700 bg-blush-50 border border-blush-200 rounded-xl px-3 py-2 mt-4">{error}</p>}
        </div>

        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-blush-100">
          <button
            onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
            disabled={stepIndex === 0}
            className="flex items-center gap-1 text-sm text-plum-500 disabled:opacity-0 hover:text-plum-700"
          >
            <ChevronLeft size={16} /> Back
          </button>

          {isLast ? (
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-full bg-blush-500 text-white text-sm font-medium px-5 py-2.5 hover:bg-blush-600 transition-colors disabled:opacity-60"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              Add to shelf
            </button>
          ) : (
            <button
              onClick={() => setStepIndex((i) => Math.min(STEPS.length - 1, i + 1))}
              disabled={!canAdvance()}
              className="flex items-center gap-1 rounded-full bg-blush-500 text-white text-sm font-medium px-5 py-2.5 hover:bg-blush-600 transition-colors disabled:opacity-40"
            >
              Next <ChevronRight size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
