import { Check } from 'lucide-react'
import { productLabel } from '../lib/productLabel'

export default function LogTodayPrompt({ product, onConfirm, onDismiss }) {
  if (!product) return null

  return (
    <div className="fixed inset-0 z-30 bg-plum-900/40 backdrop-blur-[2px] flex items-end sm:items-center justify-center">
      <div className="bg-cream-50 w-full sm:max-w-sm sm:rounded-3xl rounded-t-3xl p-6">
        <h2 className="font-display text-xl font-semibold mb-1.5">Start logging this today?</h2>
        <p className="text-sm text-plum-500 mb-5 leading-relaxed">
          You marked <span className="font-medium text-plum-700">{productLabel(product)}</span> as a daily
          staple. Want it added to today's diary too, or just kept on your shelf for now?
        </p>
        <div className="flex gap-3">
          <button
            onClick={onDismiss}
            className="flex-1 rounded-full border border-plum-200 text-plum-600 text-sm font-medium py-2.5 hover:border-blush-300 transition-colors"
          >
            Just the shelf
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-full bg-blush-500 text-white text-sm font-medium py-2.5 hover:bg-blush-600 transition-colors"
          >
            <Check size={15} /> Log today
          </button>
        </div>
      </div>
    </div>
  )
}
