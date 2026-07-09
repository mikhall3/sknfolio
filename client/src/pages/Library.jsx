import { useEffect, useState, useMemo } from 'react'
import { Plus, Loader2 } from 'lucide-react'
import { api } from '../lib/api'
import { CATEGORY_MAP } from '../data/categories'
import ProductCard from '../components/ProductCard'
import AddProductModal from '../components/AddProductModal'
import { logFavouriteToday } from '../lib/diaryFavourites'

export default function Library() {
  const [products, setProducts] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    load()
  }, [])

  function load() {
    api
      .get('/products?status=ACTIVE')
      .then((res) => setProducts(res.products))
      .catch((err) => setError(err.message))
  }

  const grouped = useMemo(() => {
    if (!products) return []
    const map = new Map()
    for (const p of products) {
      if (!map.has(p.category)) map.set(p.category, [])
      map.get(p.category).push(p)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [products])

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

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-display text-2xl font-semibold text-plum-900">Your shelf</h1>
          <p className="text-sm text-plum-400">{products?.length ?? 0} products in rotation</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1 rounded-full bg-blush-500 text-white text-sm font-medium pl-3 pr-4 py-2 hover:bg-blush-600 transition-colors"
        >
          <Plus size={16} /> Add
        </button>
      </div>

      {error && <p className="text-sm text-blush-600 mb-4">{error}</p>}

      {!products ? (
        <div className="flex justify-center py-16 text-plum-300">
          <Loader2 size={22} className="animate-spin" />
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-plum-400 text-sm mb-1">Your shelf is empty.</p>
          <p className="text-plum-300 text-xs">Add the first thing you reach for.</p>
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
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <AddProductModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={(product) => {
          setProducts((prev) => [...(prev || []), product])
          logFavouriteToday(product)
        }}
      />
    </div>
  )
}
