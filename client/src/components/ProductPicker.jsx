import { useState } from 'react'
import { Search, Plus } from 'lucide-react'
import { CATEGORY_MAP } from '../data/categories'
import { productLabel } from '../lib/productLabel'

export default function ProductPicker({ products, onPick, onNew, onClose }) {
  const [query, setQuery] = useState('')
  const filtered = products.filter((p) => productLabel(p).toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="mt-2 rounded-2xl border border-blush-200 bg-white shadow-sm p-3">
      <div className="flex items-center gap-2 rounded-xl bg-cream-100 px-3 py-2 mb-2">
        <Search size={14} className="text-plum-300" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a product..."
          className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-plum-300"
        />
      </div>

      <div className="max-h-52 overflow-y-auto space-y-1">
        {filtered.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              onPick(p)
              onClose()
            }}
            className="w-full flex items-center justify-between rounded-xl px-2.5 py-2 text-left hover:bg-blush-50 transition-colors"
          >
            <span className="text-sm text-plum-800 truncate">{productLabel(p)}</span>
            <span className="text-[11px] text-plum-400 shrink-0 ml-2">{CATEGORY_MAP[p.category]?.label}</span>
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="text-xs text-plum-300 px-2.5 py-2">Nothing matches — add it as new.</p>
        )}
      </div>

      <button
        onClick={onNew}
        className="w-full flex items-center justify-center gap-1.5 mt-2 rounded-xl border border-dashed border-plum-200 text-plum-500 text-xs font-medium py-2 hover:border-blush-300 hover:text-blush-600 transition-colors"
      >
        <Plus size={13} /> Add a new product
      </button>
    </div>
  )
}
