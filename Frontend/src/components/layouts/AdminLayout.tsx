import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BarChart3,
  Building2,
  LayoutDashboard,
  Map,
  MessageSquare,
  ScrollText,
  Shield,
  Users,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { initials } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * The admin console shell.
 *
 * Deliberately a different surface to the traveller app: a dark slate chrome,
 * a dense sidebar, no bottom tab bar and no FAB. The point is that an operator
 * should never be in doubt about which side of the product they are on — the
 * previous version reused the traveller layout and looked identical to it.
 */
const SECTIONS = [
  { to: '/admin', end: true, icon: LayoutDashboard, label: 'Overview' },
  { to: '/admin/users', icon: Users, label: 'Users' },
  { to: '/admin/trips', icon: Map, label: 'Trips' },
  { to: '/admin/community', icon: MessageSquare, label: 'Community' },
  { to: '/admin/catalog', icon: Building2, label: 'Destinations' },
  { to: '/admin/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/admin/audit', icon: ScrollText, label: 'Audit log' },
];

export function AdminLayout() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      {/* Sidebar — always visible on desktop, a scrolling rail on mobile */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-white/10 bg-slate-900/60 p-4 md:flex">
        <div className="mb-6 flex items-center gap-2.5 px-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-white">
            <Shield className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">GlobeTrotter</p>
            <p className="text-[11px] uppercase tracking-wide text-accent">Admin console</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          {SECTIONS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-accent/15 text-accent'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-100',
                )
              }
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="space-y-2 border-t border-white/10 pt-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to app
          </button>

          {user && (
            <div className="flex items-center gap-2.5 rounded-xl bg-white/5 p-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/20 text-[11px] font-semibold text-accent">
                {initials(user.name)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-medium">{user.name}</span>
                <span className="block truncate text-[10px] text-slate-500">{user.email}</span>
              </span>
            </div>
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile chrome */}
        <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/90 backdrop-blur-xl md:hidden">
          <div className="flex h-14 items-center justify-between px-4">
            <span className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-accent" />
              <span className="text-sm font-semibold">Admin console</span>
            </span>
            <button
              onClick={() => navigate('/dashboard')}
              className="rounded-lg px-2 py-1 text-xs font-medium text-slate-400"
            >
              Exit
            </button>
          </div>

          <div className="flex gap-1 overflow-x-auto px-3 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {SECTIONS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                    isActive ? 'bg-accent/15 text-accent' : 'text-slate-400',
                  )
                }
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </NavLink>
            ))}
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8">
          {/* The console keeps its own dark palette regardless of the app theme,
              so operator screenshots and dashboards stay consistent. */}
          <div className="mx-auto w-full max-w-7xl" data-app-theme={theme}>
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}
