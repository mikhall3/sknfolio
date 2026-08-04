import { Star, PackageCheck, Loader2, AlertTriangle } from 'lucide-react'
import { CATEGORY_MAP } from '../data/categories'

const RETIRE_LABEL = { REBOUGHT: 'Rebought', REPLACED: 'Replaced', RETIRED: 'Retired' }

// A compact single-line-per-product row, built for scanning a long shelf
// fast - full stats (days on shelf, timing, notes, favourite/delete) live in
// the detail modal behind a tap, not duplicated here.
export default function ProductCard({ product, onMarkEmpty, onOpenDetail }) {
  const category = CATEGORY_MAP[product.category]
  const Icon = category?.icon
  const archived = product.status === 'ARCHIVED'
  const topLine = product.brand || product.name
  const secondLine = product.brand ? `${product.name} | ${category?.label}` : category?.label

  return (
    <div
      onClick={() => onOpenDetail(product)}
      className="flex items-center gap-3 bg-white border border-plum-100 border-l-[3px] border-l-blush-400 rounded-2xl pl-3.5 pr-2.5 py-2.5 cursor-pointer hover:border-blush-200 transition-colors"
    >
      <div className="w-9 h-9 rounded-full bg-blush-500 text-white flex items-center justify-center shrink-0">
        {Icon && <Icon size={16} strokeWidth={1.75} />}
      </div>

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 text-[11px] text-plum-400 line-clamp-1">
          {product.favourite && <Star size={10} className="text-blush-500 shrink-0" fill="currentColor" />}
          {topLine}
        </p>
        <p className="text-sm font-semibold text-plum-900 line-clamp-1">{secondLine}</p>
        {product.ingredientLookupStatus === 'PENDING' && (
          <p className="flex items-center gap-1 text-[10px] text-plum-400 mt-0.5">
            <Loader2 size={10} className="animate-spin" /> Searching ingredients…
          </p>
        )}
        {product.ingredientLookupStatus === 'ERROR' && (
          <p className="flex items-center gap-1 text-[10px] text-blush-600 mt-0.5">
            <AlertTriangle size={10} /> Ingredient search failed
          </p>
        )}
        {archived && (
          <p className="text-[10px] text-plum-400 mt-0.5">
            {RETIRE_LABEL[product.retireReason]}
            {product.emptyRating ? ` · ${product.emptyRating}/5` : ''}
          </p>
        )}
      </div>

      {!archived && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onMarkEmpty(product)
          }}
          className="shrink-0 w-8 h-8 rounded-full bg-blush-50 text-blush-500 border border-blush-200 hover:bg-blush-100 flex items-center justify-center transition-colors"
          title="Mark as empty"
        >
          <PackageCheck size={15} strokeWidth={1.75} />
        </button>
      )}
    </div>
  )
}
