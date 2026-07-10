import { useState } from 'react'
import { Star, Trash2, Sunrise, Moon, SunMoon, PackageCheck, StickyNote, ChevronDown, ChevronUp, Plus } from 'lucide-react'
import { CATEGORY_MAP, SIZE_TYPES } from '../data/categories'
import { friendlyDate } from '../lib/dates'

const TIME_ICON = { AM: Sunrise, PM: Moon, BOTH: SunMoon }
const RETIRE_LABEL = { REBOUGHT: 'Rebought', REPLACED: 'Replaced', RETIRED: 'Retired' }
const SIZE_TYPE_MAP = Object.fromEntries(SIZE_TYPES.map((s) => [s.value, s]))

export default function ProductCard({ product, onToggleFavourite, onDelete, onMarkEmpty, onAddNote }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const notes = product.notes || []
  const category = CATEGORY_MAP[product.category]
  const Icon = category?.icon
  const TimeIcon = TIME_ICON[product.timeOfDay]
  const archived = product.status === 'ARCHIVED'

  async function submitNote() {
    const text = noteDraft.trim()
    if (!text) return
    setSavingNote(true)
    try {
      await onAddNote(product, text)
      setNoteDraft('')
    } finally {
      setSavingNote(false)
    }
  }

  return (
    <div className="bg-white border border-plum-100 rounded-2xl p-3.5 flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-blush-50 text-blush-500 flex items-center justify-center shrink-0">
            {Icon && <Icon size={16} strokeWidth={1.75} />}
          </div>
          <div className="min-w-0">
            {product.brand && <p className="text-[11px] text-plum-400 truncate">{product.brand}</p>}
            <p className="text-sm font-medium text-plum-900 truncate">{product.name}</p>
            <p className="text-xs text-plum-400">{category?.label}</p>
          </div>
        </div>
        {!archived && (
          <button
            onClick={() => onToggleFavourite(product)}
            className={product.favourite ? 'text-blush-500' : 'text-plum-200 hover:text-plum-300'}
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
            <button onClick={() => onDelete(product)} className="text-blush-600 font-medium">
              Yes
            </button>
            <button onClick={() => setConfirmingDelete(false)} className="text-plum-400">
              No
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            {!archived && (
              <button
                onClick={() => onMarkEmpty(product)}
                className="text-plum-300 hover:text-blush-500"
                title="Mark as empty"
              >
                <PackageCheck size={14} strokeWidth={1.75} />
              </button>
            )}
            <button onClick={() => setConfirmingDelete(true)} className="text-plum-300 hover:text-blush-500" title="Delete outright">
              <Trash2 size={14} strokeWidth={1.75} />
            </button>
          </div>
        )}
      </div>

      <button
        onClick={() => setNotesOpen((v) => !v)}
        className="flex items-center gap-1 text-[11px] text-plum-400 hover:text-blush-600 self-start"
      >
        <StickyNote size={12} strokeWidth={1.75} />
        {notes.length > 0 ? `${notes.length} note${notes.length === 1 ? '' : 's'}` : 'Add a note'}
        {notesOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {notesOpen && (
        <div className="border-t border-plum-50 pt-2.5 space-y-2">
          {notes.length > 0 && (
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {notes.map((note) => (
                <div key={note.id} className="text-xs">
                  <span className="text-plum-300 text-[10px]">{friendlyDate(note.date.slice(0, 10))}</span>
                  <p className="text-plum-600 leading-snug">{note.text}</p>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-1.5">
            <input
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), submitNote())}
              placeholder="How's it working out?"
              className="flex-1 rounded-lg border border-plum-100 bg-cream-100 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blush-300"
            />
            <button
              onClick={submitNote}
              disabled={savingNote || !noteDraft.trim()}
              className="rounded-lg bg-plum-100 text-plum-600 px-2 hover:bg-plum-200 transition-colors disabled:opacity-50"
            >
              <Plus size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
