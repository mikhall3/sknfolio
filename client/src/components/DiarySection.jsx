import { useState } from 'react'
import { Plus, X, Sunrise, Moon } from 'lucide-react'
import { CATEGORY_MAP } from '../data/categories'
import ProductPicker from './ProductPicker'

const ICONS = { AM: Sunrise, PM: Moon }
const TITLES = { AM: 'Morning', PM: 'Evening' }

export default function DiarySection({ period, logs, availableProducts, onLog, onUnlog, onNew }) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const Icon = ICONS[period]

  return (
    <div className="bg-cream-50 border border-blush-100 rounded-2xl p-4">
      <div className="flex items-center gap-1.5 mb-3">
        <Icon size={16} className="text-blush-500" strokeWidth={1.75} />
        <h2 className="font-display text-lg font-semibold text-plum-900">{TITLES[period]}</h2>
      </div>

      {logs.length === 0 ? (
        <p className="text-xs text-plum-300 mb-3">Nothing logged yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2 mb-3">
          {logs.map(({ logId, product }) => (
            <span
              key={logId}
              className="inline-flex items-center gap-1.5 rounded-full bg-white border border-plum-100 pl-3 pr-1.5 py-1.5 text-xs text-plum-800"
            >
              {product.name}
              <span className="text-plum-300">· {CATEGORY_MAP[product.category]?.label}</span>
              <button
                onClick={() => onUnlog(logId, product.id)}
                className="text-plum-300 hover:text-blush-600 ml-0.5"
                title="Remove from today"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      <button
        onClick={() => setPickerOpen((v) => !v)}
        className="flex items-center gap-1 text-xs font-medium text-blush-600 hover:text-blush-700"
      >
        <Plus size={13} /> Log something
      </button>

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
