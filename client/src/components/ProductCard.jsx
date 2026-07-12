import { useState } from 'react'
import { Star, Trash2, Sunrise, Moon, SunMoon, PackageCheck } from 'lucide-react'
import { CATEGORY_MAP, SIZE_TYPES } from '../data/categories'

const TIME_ICON = { AM: Sunrise, PM: Moon, BOTH: SunMoon }
const RETIRE_LABEL = { REBOUGHT: 'Rebought', REPLACED: 'Replaced', RETIRED: 'Retired' }
const SIZE_TYPE_MAP = Object.fromEntries(SIZE_TYPES.map((s) => [s.value, s]))

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
            <span className="text-[11px] text-plum-400 ml-1">{RETIRE_LABEL[product.retireReason]}</span>
          </div>
          {product.emptyComment && <p className="text-xs text-plum-500 italic leading-snug">"{product.emptyComment}"</p>}
        </div>
      ) : product.sizeType ? (
        <span className="inline-flex items-center self-start rounded-full bg-plum-50 text-plum-500 text-[11px] px-2.5 py-1">
          {SIZE_TYPE_MAP[product.sizeType]?.label}
        </span>
      ) : (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-plum-50 overflow-hidden">
            <div className="h-full bg-blush-300 rounded-full" style={{ width: `${product.fillLevel}%` }} />
          </div>
          <span className="text-[11px] text-plum-400 tabular-nums">{product.fillLevel}%</span>
        </div>
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
