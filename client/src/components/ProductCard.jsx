import { useState } from 'react'
import { Star, Trash2, Sunrise, Moon, SunMoon, PackageCheck, Loader2, AlertTriangle } from 'lucide-react'
import { CATEGORY_MAP } from '../data/categories'
import { daysBetween } from '../lib/dates'

const TIME_ICON = { AM: Sunrise, PM: Moon, BOTH: SunMoon }
const RETIRE_LABEL = { REBOUGHT: 'Rebought', REPLACED: 'Replaced', RETIRED: 'Retired' }

export default function ProductCard({ product, onToggleFavourite, onDelete, onMarkEmpty, onOpenDetail }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const category = CATEGORY_MAP[product.category]
  const Icon = category?.icon
  const TimeIcon = TIME_ICON[product.timeOfDay]
  const archived = product.status === 'ARCHIVED'

  return (
    <div
      onClick={() => onOpenDetail(product)}
      className="bg-white border border-plum-100 rounded-2xl p-3.5 flex flex-col gap-2.5 cursor-pointer hover:border-blush-200 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-blush-50 text-blush-500 flex items-center justify-center shrink-0">
            {Icon && <Icon size={16} strokeWidth={1.75} />}
          </div>
          <div className="min-w-0">
            {product.brand && <p className="text-[11px] text-plum-400 line-clamp-1">{product.brand}</p>}
            <p className="text-sm font-medium text-plum-900 line-clamp-2 leading-tight">{product.name}</p>
            <p className="text-xs text-plum-400 mt-0.5">{category?.label}</p>
            {product.ingredientLookupStatus === 'PENDING' && (
              <p className="flex items-center gap-1 text-[10px] text-plum-400 mt-1">
                <Loader2 size={10} className="animate-spin" /> Searching ingredients…
              </p>
            )}
            {product.ingredientLookupStatus === 'ERROR' && (
              <p className="flex items-center gap-1 text-[10px] text-blush-600 mt-1">
                <AlertTriangle size={10} /> Ingredient search failed
              </p>
            )}
          </div>
        </div>
        {!archived && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleFavourite(product)
            }}
            className={`shrink-0 ${product.favourite ? 'text-blush-500' : 'text-plum-200 hover:text-plum-300'}`}
            title={product.favourite ? 'Daily staple' : 'Mark as daily staple'}
          >
            <Star size={17} fill={product.favourite ? 'currentColor' : 'none'} strokeWidth={1.75} />
          </button>
        )}
      </div>

      {archived ? (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                size={12}
                className="text-blush-400"
                fill={n <= (product.emptyRating || 0) ? 'currentColor' : 'none'}
                strokeWidth={1.5}
              />
            ))}
            <span className="text-[11px] text-plum-400 ml-1">
              {RETIRE_LABEL[product.retireReason]} · lasted {daysBetween(product.dateAdded, product.archivedAt)}d
            </span>
          </div>
          {product.emptyComment && <p className="text-xs text-plum-500 italic leading-snug">"{product.emptyComment}"</p>}
        </div>
      ) : (
        <p className="text-[11px] text-plum-400">On shelf for {daysBetween(product.dateAdded)} days</p>
      )}

      <div className="flex items-center justify-between">
        {archived ? <span /> : (
          <span className="inline-flex items-center gap-1 text-[11px] text-plum-400">
            <TimeIcon size={12} strokeWidth={1.75} />
            {product.timeOfDay === 'BOTH' ? 'AM & PM' : product.timeOfDay}
          </span>
        )}

        {confirmingDelete ? (
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-plum-400">Remove for good?</span>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete(product)
              }}
              className="text-blush-600 font-medium"
            >
              Yes
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setConfirmingDelete(false)
              }}
              className="text-plum-400"
            >
              No
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            {!archived && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onMarkEmpty(product)
                }}
                className="text-plum-300 hover:text-blush-500"
                title="Mark as empty"
              >
                <PackageCheck size={14} strokeWidth={1.75} />
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation()
                setConfirmingDelete(true)
              }}
              className="text-plum-300 hover:text-blush-500"
              title="Delete outright"
            >
              <Trash2 size={14} strokeWidth={1.75} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
