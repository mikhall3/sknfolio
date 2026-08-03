import { useEffect, useRef, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Loader2, Activity, Sparkles, RotateCcw } from 'lucide-react'
import { api } from '../lib/api'
import { localDateString, addDays, friendlyDate } from '../lib/dates'
import DiarySection from '../components/DiarySection'
import AddProductModal from '../components/AddProductModal'
import EmptyProductModal from '../components/EmptyProductModal'
import ProductDetailModal from '../components/ProductDetailModal'
import DiaryConflictBanner from '../components/DiaryConflictBanner'
import AbnormalityModal from '../components/AbnormalityModal'
import { logFavouriteToday } from '../lib/diaryFavourites'

const TODAY = localDateString()
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export default function Diary() {
  const [searchParams] = useSearchParams()
  const requestedDate = searchParams.get('date')
  const [dateStr, setDateStr] = useState(
    requestedDate && DATE_RE.test(requestedDate) ? requestedDate : TODAY
  )
  const [entry, setEntry] = useState(null)
  const [activeProducts, setActiveProducts] = useState([])
  const [note, setNote] = useState('')
  const [modalConfig, setModalConfig] = useState(null)
  const [trackingOpen, setTrackingOpen] = useState(false)
  const [detailProduct, setDetailProduct] = useState(null)
  const [emptyingProduct, setEmptyingProduct] = useState(null)
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewError, setReviewError] = useState('')
  const noteTimer = useRef(null)

  useEffect(() => {
    let cancelled = false
    setEntry(null)
    setReviewLoading(false)
    setReviewError('')
    const loader =
      dateStr === TODAY ? api.post(`/diary/${dateStr}/prime-favourites`) : api.get(`/diary/${dateStr}`)
    loader.then((res) => {
      if (cancelled) return
      setEntry(res.entry)
      setNote(res.entry.note)
    })
    return () => {
      cancelled = true
    }
  }, [dateStr])

  const loadActiveProducts = useCallback(() => {
    api.get('/products?status=ACTIVE').then((res) => setActiveProducts(res.products))
  }, [])

  useEffect(() => {
    loadActiveProducts()
  }, [loadActiveProducts])

  // Ingredient lookups run on the server in the background - poll while any
  // product is still searching so the diary picks it up on its own.
  useEffect(() => {
    if (!activeProducts.some((p) => p.ingredientLookupStatus === 'PENDING')) return
    const interval = setInterval(loadActiveProducts, 4000)
    return () => clearInterval(interval)
  }, [activeProducts, loadActiveProducts])

  function refreshEntry() {
    api.get(`/diary/${dateStr}`).then((res) => setEntry(res.entry))
  }

  async function handleLog(period, productId) {
    setEntry((prev) => {
      if (!prev) return prev
      const product = activeProducts.find((p) => p.id === productId)
      if (!product) return prev
      const key = period === 'AM' ? 'am' : 'pm'
      return { ...prev, [key]: [...prev[key], { logId: `temp-${productId}`, product }] }
    })
    try {
      await api.post(`/diary/${dateStr}/log`, { productId, period })
      refreshEntry()
    } catch {
      refreshEntry()
    }
  }

  async function handleUnlog(period, logId, productId) {
    setEntry((prev) => {
      if (!prev) return prev
      const key = period === 'AM' ? 'am' : 'pm'
      return { ...prev, [key]: prev[key].filter((l) => l.logId !== logId) }
    })
    try {
      await api.delete(`/diary/${dateStr}/log?productId=${productId}&period=${period}`)
    } catch {
      refreshEntry()
    }
  }

  async function handleReorder(period, logIds) {
    const key = period === 'AM' ? 'am' : 'pm'
    setEntry((prev) => {
      if (!prev) return prev
      const byId = new Map(prev[key].map((l) => [l.logId, l]))
      return { ...prev, [key]: logIds.map((id) => byId.get(id)) }
    })
    try {
      await api.put(`/diary/${dateStr}/log/reorder`, { period, logIds })
    } catch {
      refreshEntry()
    }
  }

  async function handleLockIn(period, productIds) {
    await api.post('/products/reorder', { period, productIds })
  }

  async function generateReview() {
    setReviewLoading(true)
    setReviewError('')
    try {
      const { entry: updated } = await api.post(`/diary/${dateStr}/review`, {})
      setEntry(updated)
    } catch (err) {
      setReviewError(err.message || 'Could not generate a review right now.')
    } finally {
      setReviewLoading(false)
    }
  }

  function handleNoteChange(value) {
    setNote(value)
    clearTimeout(noteTimer.current)
    noteTimer.current = setTimeout(() => {
      api.put(`/diary/${dateStr}/note`, { note: value })
    }, 600)
  }

  // "When do you use it?" is a default/suggestion, not a hard restriction -
  // any active product can be logged in either period (e.g. a usual morning
  // product used one evening), it just sorts the usual-period ones first.
  function availableFor(period) {
    const loggedIds = new Set((entry?.[period === 'AM' ? 'am' : 'pm'] || []).map((l) => l.product.id))
    const notLoggedToday = activeProducts.filter((p) => !loggedIds.has(p.id))
    const matchesPeriod = (p) => p.timeOfDay === period || p.timeOfDay === 'BOTH'
    return [...notLoggedToday.filter(matchesPeriod), ...notLoggedToday.filter((p) => !matchesPeriod(p))]
  }

  function handleProductUpdated(product) {
    setActiveProducts((prev) => {
      const others = prev.filter((p) => p.id !== product.id)
      return product.status === 'ACTIVE' ? [...others, product] : others
    })
    refreshEntry()
  }

  function handleEmptyDone({ action, product, rebought }) {
    setActiveProducts((prev) => prev.filter((p) => p.id !== product.id))
    setEmptyingProduct(null)
    if (action === 'rebuy' && rebought) {
      setActiveProducts((prev) => [...prev, rebought])
      logFavouriteToday(rebought).then(refreshEntry)
    }
    if (action === 'replace') {
      setModalConfig({ defaultCategory: product.category, defaultTimeOfDay: product.timeOfDay })
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={() => setDateStr((d) => addDays(d, -1))}
          className="w-8 h-8 flex items-center justify-center rounded-full text-plum-400 hover:bg-plum-50"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="text-center">
          <h1 className="font-display text-2xl font-semibold text-plum-900">{friendlyDate(dateStr)}</h1>
          {dateStr !== TODAY && (
            <button onClick={() => setDateStr(TODAY)} className="text-xs text-blush-600 font-medium">
              Back to today
            </button>
          )}
        </div>
        <button
          onClick={() => setDateStr((d) => addDays(d, 1))}
          disabled={dateStr === TODAY}
          className="w-8 h-8 flex items-center justify-center rounded-full text-plum-400 hover:bg-plum-50 disabled:opacity-30"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {entry && (
        <DiaryConflictBanner
          key={dateStr}
          products={[...new Map(
            [...entry.am, ...entry.pm].map((l) => [l.product.id, l.product])
          ).values()]}
        />
      )}

      {!entry ? (
        <div className="flex justify-center py-16 text-plum-300">
          <Loader2 size={22} className="animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          <DiarySection
            key={`am-${dateStr}`}
            period="AM"
            logs={entry.am}
            availableProducts={availableFor('AM')}
            onLog={(productId) => handleLog('AM', productId)}
            onUnlog={(logId, productId) => handleUnlog('AM', logId, productId)}
            onNew={() => setModalConfig({ defaultTimeOfDay: 'AM' })}
            onOpenDetail={setDetailProduct}
            onReorder={(logIds) => handleReorder('AM', logIds)}
            onLockIn={(productIds) => handleLockIn('AM', productIds)}
          />
          <DiarySection
            key={`pm-${dateStr}`}
            period="PM"
            logs={entry.pm}
            availableProducts={availableFor('PM')}
            onLog={(productId) => handleLog('PM', productId)}
            onUnlog={(logId, productId) => handleUnlog('PM', logId, productId)}
            onNew={() => setModalConfig({ defaultTimeOfDay: 'PM' })}
            onOpenDetail={setDetailProduct}
            onReorder={(logIds) => handleReorder('PM', logIds)}
            onLockIn={(productIds) => handleLockIn('PM', productIds)}
          />

          <div className="bg-cream-50 border border-blush-100 rounded-2xl p-4">
            <h2 className="font-display text-lg font-semibold text-plum-900 mb-2">Notes</h2>
            <textarea
              value={note}
              onChange={(e) => handleNoteChange(e.target.value)}
              placeholder="How did skin feel today? Anything you noticed?"
              rows={3}
              className="w-full bg-transparent text-sm text-plum-800 placeholder:text-plum-300 focus:outline-none resize-none"
            />
            <button
              onClick={() => setTrackingOpen(true)}
              className="flex items-center gap-1 text-xs font-medium text-blush-600 hover:text-blush-700 mt-2"
            >
              <Activity size={13} /> Track a change on skin
            </button>
          </div>

          {entry.am.length + entry.pm.length > 0 && (
            <div className="bg-cream-50 border border-blush-100 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-display text-lg font-semibold text-plum-900">Review today's routine</h2>
                {entry.review && (
                  <button
                    onClick={generateReview}
                    disabled={reviewLoading}
                    title="Refresh review"
                    className="text-plum-400 hover:text-blush-600 disabled:opacity-50 shrink-0"
                  >
                    <RotateCcw size={14} className={reviewLoading ? 'animate-spin' : ''} />
                  </button>
                )}
              </div>

              {!entry.review ? (
                <div>
                  <p className="text-xs text-plum-500 mb-3 leading-relaxed">
                    Get a quick read on today's actives, how they paired, and a tip for tomorrow.
                  </p>
                  <button
                    onClick={generateReview}
                    disabled={reviewLoading}
                    className="flex items-center gap-1.5 rounded-full bg-blush-500 text-white text-xs font-medium px-4 py-2 hover:bg-blush-600 transition-colors disabled:opacity-50"
                  >
                    {reviewLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                    {reviewLoading ? 'Reviewing...' : "Review today's routine"}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-plum-800 leading-relaxed">{entry.review.summary}</p>
                  {entry.review.pairing && (
                    <p className="text-xs text-blush-600 leading-relaxed">{entry.review.pairing}</p>
                  )}
                  <p className="text-xs text-plum-600 leading-relaxed">
                    <span className="font-medium text-plum-700">Tomorrow — </span>
                    {entry.review.tomorrow}
                  </p>
                  {entry.review.stale && (
                    <button
                      onClick={generateReview}
                      disabled={reviewLoading}
                      className="text-[11px] font-medium text-plum-500 hover:text-blush-600 disabled:opacity-50"
                    >
                      {reviewLoading ? 'Refreshing…' : "Today's routine or notes changed — tap to refresh"}
                    </button>
                  )}
                </div>
              )}
              {reviewError && <p className="text-xs text-blush-600 mt-2">{reviewError}</p>}
            </div>
          )}
        </div>
      )}

      <AddProductModal
        key={modalConfig ? JSON.stringify(modalConfig) : 'closed'}
        open={Boolean(modalConfig)}
        defaultTimeOfDay={modalConfig?.defaultTimeOfDay}
        existingProducts={activeProducts}
        onClose={() => setModalConfig(null)}
        onCreated={async (product) => {
          setActiveProducts((prev) => [...prev, product])
          if (dateStr === TODAY) {
            await logFavouriteToday(product)
            refreshEntry()
          }
        }}
        onIngredientsReady={loadActiveProducts}
      />

      <AbnormalityModal
        open={trackingOpen}
        date={dateStr}
        onClose={() => setTrackingOpen(false)}
        onLogged={() => {}}
      />

      <EmptyProductModal
        open={Boolean(emptyingProduct)}
        product={emptyingProduct}
        onClose={() => setEmptyingProduct(null)}
        onDone={handleEmptyDone}
      />

      {detailProduct && (
        <ProductDetailModal
          key={detailProduct.id}
          product={detailProduct}
          onClose={() => setDetailProduct(null)}
          onUpdated={handleProductUpdated}
          onMarkEmpty={(product) => {
            setDetailProduct(null)
            setEmptyingProduct(product)
          }}
          onDeleted={(id) => {
            setDetailProduct(null)
            setActiveProducts((prev) => prev.filter((p) => p.id !== id))
            refreshEntry()
          }}
        />
      )}
    </div>
  )
}
