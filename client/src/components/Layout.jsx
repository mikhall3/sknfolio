import { NavLink, Outlet } from 'react-router-dom'
import { BookOpen, Library, LogOut, Sparkles, TrendingUp } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const tabs = [
  { to: '/diary', label: 'Diary', icon: BookOpen },
  { to: '/library', label: 'Library', icon: Library },
  { to: '/insights', label: 'Insights', icon: TrendingUp },
]

export default function Layout() {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen bg-cream-100 flex flex-col">
      <header className="sticky top-0 z-10 bg-cream-100/90 backdrop-blur-sm border-b border-blush-100">
        <div className="max-w-lg mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-1.5">
            <Sparkles size={16} className="text-blush-500" strokeWidth={1.75} />
            <span className="font-display text-lg font-semibold tracking-tight text-plum-900">
              SKNFOLIO
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-plum-400 hidden sm:block">{user?.email}</span>
            <button
              onClick={logout}
              className="text-plum-400 hover:text-blush-600 transition-colors"
              title="Sign out"
            >
              <LogOut size={17} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-lg w-full mx-auto px-4 pt-5 pb-24">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 inset-x-0 bg-cream-50/95 backdrop-blur-sm border-t border-blush-100">
        <div className="max-w-lg mx-auto flex">
          {tabs.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs transition-colors ${
                  isActive ? 'text-blush-600' : 'text-plum-400'
                }`
              }
            >
              <Icon size={20} strokeWidth={1.75} />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
