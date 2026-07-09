import { useState } from 'react'
import { Star, Trash2, Sunrise, Moon, SunMoon } from 'lucide-react'
import { CATEGORY_MAP } from '../data/categories'

const TIME_ICON = { AM: Sunrise, PM: Moon, BOTH: SunMoon }

export default function ProductCard({ product, onToggleFavourite, onDelete }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const category = CATEGORY_MAP[product.category]
  const Icon = category?.icon
  const TimeIcon = TIME_ICON[product.timeOfDay]

  return (
    <div className="bg-white border border-plum-100 rounded-2xl p-3.5 flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-blush-50 text-blush-500 flex items-center justify-center shrink-0">
            {Icon && <Icon size={16} strokeWidth={1.75} />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-plum-900 truncate">{product.name}</p>
            <p className="text-xs text-plum-400">{category?.label}</p>
          </div>
        </div>
        <button
          onClick={() => onToggleFavourite(product)}
          className={product.favourite ? 'text-blush-500' : 'text-plum-200 hover:text-plum-300'}
          title={product.favourite ? 'Daily staple' : 'Mark as daily staple'}
        >
          <Star size={17} fill={product.favourite ? 'currentColor' : 'none'} strokeWidth={1.75} />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-plum-50 overflow-hidden">
          <div className="h-full bg-blush-300 rounded-full" style={{ width: `${product.fillLevel}%` }} />
        </div>
        <span className="text-[11px] text-plum-400 tabular-nums">{product.fillLevel}%</span>
      </div>

      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1 text-[11px] text-plum-400">
          <TimeIcon size={12} strokeWidth={1.75} />
          {product.timeOfDay === 'BOTH' ? 'AM & PM' : product.timeOfDay}
        </span>

        {confirmingDelete ? (
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-plum-400">Remove for good?</span>
            <button onClick={() => onDelete(product)} className="text-blush-600 font-medium">
              Yes
            </button>
            <button onClick={() => setConfirmingDelete(false)} className="text-plum-400">
              No
            </button>
          </div>
        ) : (
          <button onClick={() => setConfirmingDelete(true)} className="text-plum-300 hover:text-blush-500">
            <Trash2 size={14} strokeWidth={1.75} />
          </button>
        )}
      </div>
    </div>
  )
}
