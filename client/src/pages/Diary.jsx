import { useEffect, useRef, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Loader2, Activity } from 'lucide-react'
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
  const noteTimer = useRef(null)

  useEffect(() => {
    let cancelled = false
    setEntry(null)
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

  function handleNoteChange(value) {
    setNote(value)
    clearTimeout(noteTimer.current)
    noteTimer.current = setTimeout(() => {
      api.put(`/diary/${dateStr}/note`, { note: value })
    }, 600)
  }

  function availableFor(period) {
    const loggedIds = new Set((entry?.[period === 'AM' ? 'am' : 'pm'] || []).map((l) => l.product.id))
    return activeProducts.filter(
      (p) => !loggedIds.has(p.id) && (p.timeOfDay === period || p.timeOfDay === 'BOTH')
    )
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
