import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Mail, ArrowRight, Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { requestLink } = useAuth()
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [devLink, setDevLink] = useState(null)

  const expired = searchParams.get('error') === 'expired'

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setStatus('loading')
    try {
      const res = await requestLink(email)
      setDevLink(res?.devLink || null)
      setStatus('sent')
    } catch (err) {
      setError(err.message || 'Something went wrong.')
      setStatus('idle')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream-100 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="SKNFOLIO" className="h-12 mx-auto mb-2" />
          <p className="text-plum-500 text-sm mt-1">a little diary, for your face</p>
        </div>

        <div className="bg-cream-50 border border-blush-100 border-t-4 border-t-blush-500 rounded-3xl shadow-sm p-7">
          {status === 'sent' ? (
            <div className="text-center py-2">
              <div className="mx-auto w-11 h-11 rounded-full bg-blush-500 text-white flex items-center justify-center mb-4">
                <Mail size={20} strokeWidth={1.75} />
              </div>
              <h2 className="font-display text-xl font-semibold mb-1.5">Check your inbox</h2>
              <p className="text-sm text-plum-500 leading-relaxed">
                We sent a sign-in link to <span className="text-plum-700 font-medium">{email}</span>.
                It expires in 15 minutes.
              </p>
              {devLink && (
                <a
                  href={devLink}
                  className="mt-5 inline-block text-xs text-blush-600 bg-blush-50 border border-blush-200 rounded-full px-4 py-2 hover:bg-blush-100 transition-colors break-all"
                >
                  Dev mode — no SMTP configured, click to sign in
                </a>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <h2 className="font-display text-xl font-semibold mb-1.5">Welcome back</h2>
              <p className="text-sm text-plum-500 mb-5 leading-relaxed">
                Enter your email and we'll send you a link to sign in — no password needed.
              </p>

              {expired && (
                <p className="text-xs text-blush-600 bg-blush-50 border border-blush-200 rounded-xl px-3 py-2 mb-4">
                  That link expired. Enter your email for a new one.
                </p>
              )}
              {error && (
                <p className="text-xs text-blush-700 bg-blush-50 border border-blush-200 rounded-xl px-3 py-2 mb-4">
                  {error}
                </p>
              )}

              <label className="block text-xs font-medium text-plum-500 mb-1.5" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-plum-200 bg-white px-3.5 py-2.5 text-sm text-plum-900 placeholder:text-plum-300 focus:outline-none focus:ring-2 focus:ring-blush-300 focus:border-transparent mb-4"
              />

              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full flex items-center justify-center gap-1.5 rounded-full bg-blush-500 text-white text-sm font-medium py-2.5 hover:bg-blush-600 transition-colors disabled:opacity-60"
              >
                {status === 'loading' ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <>
                    Send my link <ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-plum-300 mt-6">
          Your diary, your account, your device or any other.
        </p>
      </div>
    </div>
  )
}
