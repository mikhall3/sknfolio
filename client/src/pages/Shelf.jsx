import { useEffect, useState, useMemo } from 'react'
import { Plus, Loader2 } from 'lucide-react'
import { api } from '../lib/api'
import { CATEGORY_MAP } from '../data/categories'
import ProductCard from '../components/ProductCard'
import AddProductModal from '../components/AddProductModal'
import EmptyProductModal from '../components/EmptyProductModal'
import ProductDetailModal from '../components/ProductDetailModal'
import ConflictBanner from '../components/ConflictBanner'
import LogTodayPrompt from '../components/LogTodayPrompt'
import { logFavouriteToday } from '../lib/diaryFavourites'
import { commonIngredients, pairKey } from '../lib/ingredientStats'
import { CURATED_INGREDIENTS } from '../data/ingredients'
import { Check, RotateCcw } from 'lucide-react'

export default function Shelf() {
  const [products, setProducts] = useState(null)
  const [tab, setTab] = useState('active')
  const [addModalConfig, setAddModalConfig] = useState(null)
  const [emptyingProduct, setEmptyingProduct] = useState(null)
  const [logPromptProduct, setLogPromptProduct] = useState(null)
  const [detailProduct, setDetailProduct] = useState(null)
  const [error, setError] = useState('')
  const [acknowledgements, setAcknowledgements] = useState([])

  useEffect(() => {
    load()
    api.get('/conflicts').then((res) => setAcknowledgements(res.acknowledgements)).catch(() => {})
  }, [])

  function load() {
    api
      .get('/products')
      .then((res) => setProducts(res.products))
      .catch((err) => setError(err.message))
  }

  const acknowledgedKeys = useMemo(
    () => new Set(acknowledgements.map((a) => pairKey(a.ingredientA, a.ingredientB))),
    [acknowledgements]
  )

  const ingredientByKey = useMemo(() => new Map(CURATED_INGREDIENTS.map((i) => [i.key, i])), [])

  async function acknowledgeConflict(keyA, keyB) {
    const res = await api.post('/conflicts', { ingredientA: keyA, ingredientB: keyB })
    setAcknowledgements((prev) => [...prev.filter((a) => pairKey(a.ingredientA, a.ingredientB) !== pairKey(keyA, keyB)), res.acknowledgement])
  }

  async function undoAcknowledgement(id) {
    setAcknowledgements((prev) => prev.filter((a) => a.id !== id))
    try {
      await api.delete(`/conflicts/${id}`)
    } catch {
      api.get('/conflicts').then((res) => setAcknowledgements(res.acknowledgements))
    }
  }

  const visibleProducts = useMemo(() => {
    if (!products) return null
    const status = tab === 'active' ? 'ACTIVE' : 'ARCHIVED'
    return products.filter((p) => p.status === status)
  }, [products, tab])

  const grouped = useMemo(() => {
    if (!visibleProducts) return []
    const map = new Map()
    for (const p of visibleProducts) {
      if (!map.has(p.category)) map.set(p.category, [])
      map.get(p.category).push(p)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [visibleProducts])

  const activeProducts = useMemo(() => (products || []).filter((p) => p.status === 'ACTIVE'), [products])
  const topIngredients = useMemo(() => commonIngredients(activeProducts).slice(0, 5), [activeProducts])

  function upsertProduct(product) {
    setProducts((prev) => {
      const others = (prev || []).filter((p) => p.id !== product.id)
      return [...others, product]
    })
  }

  async function toggleFavourite(product) {
    setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, favourite: !p.favourite } : p)))
    try {
      await api.patch(`/products/${product.id}`, { favourite: !product.favourite })
    } catch {
      load()
    }
  }

  async function deleteProduct(product) {
    setProducts((prev) => prev.filter((p) => p.id !== product.id))
    try {
      await api.delete(`/products/${product.id}`)
    } catch {
      load()
    }
  }

  function handleEmptyDone({ action, product, rebought }) {
    upsertProduct(product)
    setEmptyingProduct(null)
    if (action === 'rebuy' && rebought) {
      setProducts((prev) => [...prev, rebought])
      logFavouriteToday(rebought)
    }
    if (action === 'replace') {
      setAddModalConfig({ defaultCategory: product.category, defaultTimeOfDay: product.timeOfDay })
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-plum-900">Your shelf</h1>
          <p className="text-sm text-plum-400">
            {tab === 'active' ? `${visibleProducts?.length ?? 0} products in rotation` : `${visibleProducts?.length ?? 0} finished up`}
          </p>
        </div>
        <button
          onClick={() => setAddModalConfig({})}
          className="flex items-center gap-1 rounded-full bg-blush-500 text-white text-sm font-medium pl-3 pr-4 py-2 hover:bg-blush-600 transition-colors"
        >
          <Plus size={16} /> Add
        </button>
      </div>

      <div className="inline-flex rounded-full bg-plum-50 p-1 mb-5 text-sm">
        <button
          onClick={() => setTab('active')}
          className={`px-4 py-1.5 rounded-full font-medium transition-colors ${
            tab === 'active' ? 'bg-white text-blush-600 shadow-sm' : 'text-plum-400'
          }`}
        >
          Active
        </button>
        <button
          onClick={() => setTab('archived')}
          className={`px-4 py-1.5 rounded-full font-medium transition-colors ${
            tab === 'archived' ? 'bg-white text-blush-600 shadow-sm' : 'text-plum-400'
          }`}
        >
          Finished
        </button>
      </div>

      {tab === 'active' && (
        <ConflictBanner
          products={activeProducts}
          acknowledgedKeys={acknowledgedKeys}
          onAcknowledge={acknowledgeConflict}
        />
      )}

      {tab === 'active' && acknowledgements.length > 0 && (
        <div className="rounded-2xl border border-plum-100 bg-plum-50/50 p-4 mb-5">
          <p className="text-xs font-semibold text-plum-400 uppercase tracking-wide mb-2">Reviewed overlaps</p>
          <div className="space-y-2">
            {acknowledgements.map((a) => {
              const ingA = ingredientByKey.get(a.ingredientA)
              const ingB = ingredientByKey.get(a.ingredientB)
              return (
                <div key={a.id} className="flex items-center justify-between gap-2">
                  <span className="text-xs text-plum-600">
                    <Check size={12} className="inline mr-1 text-plum-400" />
                    {ingA?.label || a.ingredientA} + {ingB?.label || a.ingredientB}
                  </span>
                  <button
                    onClick={() => undoAcknowledgement(a.id)}
                    className="shrink-0 flex items-center gap-1 text-[11px] font-medium text-plum-400 hover:text-blush-600 transition-colors"
                    title="Show this warning again"
                  >
                    <RotateCcw size={11} /> Undo
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {tab === 'active' && topIngredients.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-5">
          <span className="text-xs text-plum-400 mr-0.5">Most used:</span>
          {topIngredients.map((ing) => (
            <span
              key={ing.key}
              className="inline-flex items-center gap-1 rounded-full bg-plum-50 text-plum-500 text-xs px-2.5 py-1"
            >
              {ing.label}
              <span className="text-plum-300">· {ing.count}</span>
            </span>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-blush-600 mb-4">{error}</p>}

      {!products ? (
        <div className="flex justify-center py-16 text-plum-300">
          <Loader2 size={22} className="animate-spin" />
        </div>
      ) : visibleProducts.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-plum-400 text-sm mb-1">
            {tab === 'active' ? 'Your shelf is empty.' : "Nothing finished up yet."}
          </p>
          <p className="text-plum-300 text-xs">
            {tab === 'active' ? 'Add the first thing you reach for.' : 'Empties will land here once you use something up.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([category, items]) => (
            <div key={category}>
              <h2 className="text-xs font-semibold text-plum-400 uppercase tracking-wide mb-2">
                {CATEGORY_MAP[category]?.label} · {items.length}
              </h2>
              <div className="grid grid-cols-2 gap-2.5">
                {items.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onToggleFavourite={toggleFavourite}
                    onDelete={deleteProduct}
                    onMarkEmpty={setEmptyingProduct}
                    onOpenDetail={setDetailProduct}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <AddProductModal
        key={addModalConfig ? JSON.stringify(addModalConfig) : 'closed'}
        open={Boolean(addModalConfig)}
        defaultCategory={addModalConfig?.defaultCategory}
        defaultTimeOfDay={addModalConfig?.defaultTimeOfDay}
        existingProducts={activeProducts}
        onClose={() => setAddModalConfig(null)}
        onCreated={(product) => {
          setProducts((prev) => [...(prev || []), product])
          if (product.favourite) setLogPromptProduct(product)
        }}
      />

      <LogTodayPrompt
        product={logPromptProduct}
        onConfirm={async () => {
          await logFavouriteToday(logPromptProduct)
          setLogPromptProduct(null)
        }}
        onDismiss={() => setLogPromptProduct(null)}
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
          onUpdated={upsertProduct}
          onMarkEmpty={(product) => {
            setDetailProduct(null)
            setEmptyingProduct(product)
          }}
          onDeleted={(id) => {
            setDetailProduct(null)
            setProducts((prev) => prev.filter((p) => p.id !== id))
          }}
        />
      )}
    </div>
  )
}
