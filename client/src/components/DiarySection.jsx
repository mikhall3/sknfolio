import { useState } from 'react'
import { Plus, X, Sunrise, Moon, ChevronUp, ChevronDown, Lock, Check } from 'lucide-react'
import { CATEGORY_MAP } from '../data/categories'
import { productLabel } from '../lib/productLabel'
import ProductPicker from './ProductPicker'

const ICONS = { AM: Sunrise, PM: Moon }
const TITLES = { AM: 'Morning', PM: 'Evening' }

export default function DiarySection({
  period,
  logs,
  availableProducts,
  onLog,
  onUnlog,
  onNew,
  onOpenDetail,
  onReorder,
  onLockIn,
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const Icon = ICONS[period]

  // Derived from the products' own saved order rather than local state, so
  // "Locked in" still reads correctly after a reload - not just until the
  // next remount.
  const orderField = period === 'AM' ? 'amOrder' : 'pmOrder'
  const locked = logs.length > 0 && logs.every((l, i) => l.product[orderField] === i)

  function move(index, direction) {
    const next = index + direction
    if (next < 0 || next >= logs.length) return
    const reordered = [...logs]
    ;[reordered[index], reordered[next]] = [reordered[next], reordered[index]]
    onReorder(reordered.map((l) => l.logId))
  }

  async function lockIn() {
    await onLockIn(logs.map((l) => l.product.id))
  }

  return (
    <div className="bg-cream-50 border border-blush-200 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-full bg-blush-500 text-white flex items-center justify-center shrink-0">
          <Icon size={13} strokeWidth={1.75} />
        </div>
        <h2 className="font-display text-lg font-semibold text-plum-900">{TITLES[period]}</h2>
      </div>

      {logs.length === 0 ? (
        <p className="text-xs text-plum-300 mb-3">Nothing logged yet.</p>
      ) : (
        <div className="space-y-1.5 mb-3">
          {logs.map(({ logId, product }, index) => (
            <div
              key={logId}
              onClick={() => onOpenDetail(product)}
              className="flex items-center gap-2 rounded-xl bg-white border border-plum-100 border-l-[3px] border-l-blush-400 pl-3 pr-1.5 py-1.5 text-xs text-plum-800 cursor-pointer hover:border-blush-200 transition-colors"
            >
              <span className="flex items-center justify-center w-4 h-4 rounded-full bg-blush-50 text-blush-600 font-semibold text-[10px] shrink-0">
                {index + 1}
              </span>
              <span className="flex-1 min-w-0 truncate">
                {productLabel(product)} <span className="text-plum-300">· {CATEGORY_MAP[product.category]?.label}</span>
              </span>
              <div className="flex items-center shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    move(index, -1)
                  }}
                  disabled={index === 0}
                  className="text-plum-300 hover:text-blush-600 disabled:opacity-20 disabled:hover:text-plum-300 p-0.5"
                  title="Move earlier"
                >
                  <ChevronUp size={13} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    move(index, 1)
                  }}
                  disabled={index === logs.length - 1}
                  className="text-plum-300 hover:text-blush-600 disabled:opacity-20 disabled:hover:text-plum-300 p-0.5"
                  title="Move later"
                >
                  <ChevronDown size={13} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onUnlog(logId, product.id)
                  }}
                  className="text-plum-300 hover:text-blush-600 ml-1"
                  title="Remove from today"
                >
                  <X size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          onClick={() => setPickerOpen((v) => !v)}
          className="flex items-center gap-1 text-xs font-medium text-blush-600 hover:text-blush-700"
        >
          <Plus size={13} /> Log something
        </button>

        {logs.length > 1 && (
          <button
            onClick={lockIn}
            className="flex items-center gap-1 text-[11px] font-medium text-plum-400 hover:text-blush-600 transition-colors"
            title="Use this order as the default for future days"
          >
            {locked ? (
              <>
                <Check size={12} /> Locked in
              </>
            ) : (
              <>
                <Lock size={12} /> Lock in this order
              </>
            )}
          </button>
        )}
      </div>

      {pickerOpen && (
        <ProductPicker
          products={availableProducts}
          onPick={(p) => onLog(p.id)}
          onNew={() => {
            setPickerOpen(false)
            onNew()
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  )
}
