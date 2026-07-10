import { useEffect, useState } from 'react'
import { Flame, Smile, Meh, Frown, Loader2, Plus, Pencil, Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import { localDateString, friendlyDate } from '../lib/dates'
import { FEELING_OPTIONS, ABNORMALITY_TYPES } from '../data/insights'
import { productLabel } from '../lib/productLabel'
import AbnormalityModal from '../components/AbnormalityModal'

const TODAY = localDateString()

const FEELING_ICON = { GREAT: Smile, OKAY: Meh, ROUGH: Frown }
const ABNORMALITY_LABEL = Object.fromEntries(ABNORMALITY_TYPES.map((t) => [t.value, t.label]))

export default function Insights() {
  const [data, setData] = useState(null)
  const [abnormalities, setAbnormalities] = useState(null)
  const [editingCheckin, setEditingCheckin] = useState(false)
  const [feeling, setFeeling] = useState(null)
  const [checkinNote, setCheckinNote] = useState('')
  const [savingCheckin, setSavingCheckin] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    load()
    api.get('/abnormalities').then((res) => setAbnormalities(res.abnormalities))
  }, [])

  function load() {
    api.get(`/insights?today=${TODAY}`).then((res) => {
      setData(res)
      setFeeling(res.checkin.current?.feeling || null)
      setCheckinNote(res.checkin.current?.note || '')
    })
  }

  async function submitCheckin() {
    if (!feeling) return
    setSavingCheckin(true)
    try {
      await api.post('/checkins', { today: TODAY, feeling, note: checkinNote })
      setEditingCheckin(false)
      load()
    } finally {
      setSavingCheckin(false)
    }
  }

  async function deleteAbnormality(id) {
    setAbnormalities((prev) => prev.filter((a) => a.id !== id))
    try {
      await api.delete(`/abnormalities/${id}`)
    } catch {
      api.get('/abnormalities').then((res) => setAbnormalities(res.abnormalities))
    }
  }

  if (!data) {
    return (
      <div className="flex justify-center py-16 text-plum-300">
        <Loader2 size={22} className="animate-spin" />
      </div>
    )
  }

  const showCheckinForm = editingCheckin || !data.checkin.current

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-semibold text-plum-900 mb-1">Insights</h1>

      <div className="bg-cream-50 border border-blush-100 rounded-2xl p-4 flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-blush-100 text-blush-500 flex items-center justify-center shrink-0">
          <Flame size={20} fill={data.streak.count > 0 ? 'currentColor' : 'none'} strokeWidth={1.75} />
        </div>
        <div>
          <p className="font-display text-xl font-semibold text-plum-900">
            {data.streak.count} day{data.streak.count === 1 ? '' : 's'}
          </p>
          <p className="text-xs text-plum-400">
            {data.streak.hasLoggedToday
              ? "You've logged today — keep it up."
              : data.streak.count > 0
                ? "Log something today to keep your streak going."
                : 'Log your first entry to start a streak.'}
          </p>
        </div>
      </div>

      <div className="bg-cream-50 border border-blush-100 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-display text-lg font-semibold text-plum-900">This week's check-in</h2>
          {!showCheckinForm && (
            <button onClick={() => setEditingCheckin(true)} className="text-plum-400 hover:text-blush-600">
              <Pencil size={14} />
            </button>
          )}
        </div>

        {showCheckinForm ? (
          <div>
            <p className="text-sm text-plum-500 mb-3">How's your skin been overall this week?</p>
            <div className="grid grid-cols-3 gap-2.5 mb-3">
              {FEELING_OPTIONS.map(({ value, label }) => {
                const Icon = FEELING_ICON[value]
                return (
                  <button
                    key={value}
                    onClick={() => setFeeling(value)}
                    className={`flex flex-col items-center gap-1 rounded-2xl border py-3 text-sm font-medium transition-colors ${
                      feeling === value
                        ? 'border-blush-400 bg-blush-50 text-blush-700'
                        : 'border-plum-100 bg-white text-plum-500 hover:border-blush-200'
                    }`}
                  >
                    <Icon size={18} strokeWidth={1.75} />
                    {label}
                  </button>
                )
              })}
            </div>
            <textarea
              value={checkinNote}
              onChange={(e) => setCheckinNote(e.target.value)}
              placeholder="Anything you want to remember about this week? (optional)"
              rows={2}
              className="w-full rounded-xl border border-plum-200 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blush-300 focus:border-transparent resize-none mb-3"
            />
            <button
              onClick={submitCheckin}
              disabled={!feeling || savingCheckin}
              className="rounded-full bg-blush-500 text-white text-sm font-medium px-5 py-2 hover:bg-blush-600 transition-colors disabled:opacity-50"
            >
              {savingCheckin ? 'Saving...' : 'Save check-in'}
            </button>
          </div>
        ) : (
          <div className="flex items-start gap-2.5">
            {(() => {
              const Icon = FEELING_ICON[data.checkin.current.feeling]
              return <Icon size={18} className="text-blush-500 mt-0.5" strokeWidth={1.75} />
            })()}
            <div>
              <p className="text-sm text-plum-800 font-medium capitalize">
                {data.checkin.current.feeling.toLowerCase()}
              </p>
              {data.checkin.current.note && (
                <p className="text-xs text-plum-500 mt-0.5">{data.checkin.current.note}</p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="bg-cream-50 border border-blush-100 rounded-2xl p-4">
        <h2 className="font-display text-lg font-semibold text-plum-900 mb-3">Last 7 days</h2>
        <div className="space-y-3">
          {data.last7Days.map((day) => {
            const hasContent = day.am.length > 0 || day.pm.length > 0 || day.note
            return (
              <div key={day.date} className="border-b border-blush-100 last:border-0 pb-3 last:pb-0">
                <p className="text-xs font-semibold text-plum-500 mb-1">{friendlyDate(day.date)}</p>
                {!hasContent ? (
                  <p className="text-xs text-plum-300">Nothing logged.</p>
                ) : (
                  <div className="space-y-1">
                    {day.am.length > 0 && (
                      <p className="text-xs text-plum-600">
                        <span className="text-plum-400">AM ·</span>{' '}
                        {day.am.map((l) => productLabel(l.product)).join(', ')}
                      </p>
                    )}
                    {day.pm.length > 0 && (
                      <p className="text-xs text-plum-600">
                        <span className="text-plum-400">PM ·</span>{' '}
                        {day.pm.map((l) => productLabel(l.product)).join(', ')}
                      </p>
                    )}
                    {day.note && <p className="text-xs text-plum-500 italic">"{day.note}"</p>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="bg-cream-50 border border-blush-100 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg font-semibold text-plum-900">Skin tracker</h2>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1 text-xs font-medium text-blush-600 hover:text-blush-700"
          >
            <Plus size={13} /> Track something
          </button>
        </div>

        {!abnormalities ? (
          <div className="flex justify-center py-6 text-plum-300">
            <Loader2 size={18} className="animate-spin" />
          </div>
        ) : abnormalities.length === 0 ? (
          <p className="text-xs text-plum-300">Nothing tracked yet.</p>
        ) : (
          <div className="space-y-2">
            {abnormalities.map((a) => (
              <div key={a.id} className="flex items-start justify-between gap-2 border-b border-blush-100 last:border-0 pb-2 last:pb-0">
                <div className="min-w-0">
                  <p className="text-sm text-plum-800">
                    <span className="font-medium">{ABNORMALITY_LABEL[a.type]}</span>{' '}
                    <span className="text-plum-400 text-xs">
                      · severity {a.severity}/5 · {friendlyDate(a.date.slice(0, 10))}
                    </span>
                  </p>
                  {a.note && <p className="text-xs text-plum-500 mt-0.5">{a.note}</p>}
                </div>
                <button onClick={() => deleteAbnormality(a.id)} className="text-plum-300 hover:text-blush-500 shrink-0">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <AbnormalityModal
        open={modalOpen}
        date={TODAY}
        onClose={() => setModalOpen(false)}
        onLogged={(abnormality) => setAbnormalities((prev) => [abnormality, ...(prev || [])])}
      />
    </div>
  )
}
