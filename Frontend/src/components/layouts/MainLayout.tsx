import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CalendarDays,
  Compass,
  Home,
  LogOut,
  Map,
  Moon,
  Plus,
  Search,
  Shield,
  Sun,
  User,
  Users,
  Wallet,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTheme } from '@/hooks/use-theme';
import { FloatingActionButton } from '@/components/FloatingActionButton';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PageTransition } from '@/components/PageTransition';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Mobile: bottom navigation + FAB, per design.md.
 * Desktop (>=768): the same destinations become a persistent left sidebar.
 *
 * The FAB sits between Trips and Calendar in the mobile bar, so the four
 * NavLinks are split around it rather than centred as a group.
 */
const navItems = [
  { to: '/dashboard', icon: Home, label: 'Home' },
  { to: '/trips', icon: Map, label: 'Trips' },
  { to: '/community', icon: Users, label: 'Community' },
  { to: '/profile', icon: User, label: 'Profile' },
];

const desktopExtras = [
  { to: '/cities', icon: Search, label: 'Explore' },
  { to: '/calendar', icon: CalendarDays, label: 'Calendar' },
  { to: '/budget', icon: Wallet, label: 'Budget' },
];

export function MainLayout() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user, isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const isDark = theme === 'dark';
  // The public share page is its own full-bleed experience — no app chrome.
  const isPublicPage = location.pathname.startsWith('/public/');

  if (isPublicPage) {
    return (
      <main className="min-h-screen bg-background">
        <Outlet />
      </main>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      {!isMobile && (
        <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-border bg-sidebar p-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="mb-8 flex items-center gap-2.5 rounded-xl text-left"
            aria-label="GlobeTrotter home"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <Compass className="h-6 w-6" />
            </span>
            <span className="text-xl font-semibold tracking-tight">GlobeTrotter</span>
          </button>

          <nav className="flex-1 space-y-1.5">
            {[...navItems, ...desktopExtras].map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )
                }
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {item.label}
              </NavLink>
            ))}

            <button
              onClick={() => navigate('/trips/new')}
              className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Plus className="h-5 w-5 shrink-0" />
              New trip
            </button>

            {user?.role === 'ADMIN' && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )
                }
              >
                <Shield className="h-5 w-5 shrink-0" />
                Admin
              </NavLink>
            )}
          </nav>

          <div className="space-y-2">
            <Button
              variant="ghost"
              onClick={toggleTheme}
              className="w-full justify-start gap-3 text-muted-foreground"
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              {isDark ? 'Light mode' : 'Dark mode'}
            </Button>

            {isAuthenticated && (
              <>
                <Button
                  variant="ghost"
                  onClick={() => void logout()}
                  className="w-full justify-start gap-3 text-muted-foreground"
                >
                  <LogOut className="h-5 w-5" />
                  Log out
                </Button>

                {user && (
                  <button
                    onClick={() => navigate('/profile')}
                    className="flex w-full items-center gap-3 rounded-2xl bg-muted p-3 text-left transition-colors hover:bg-border"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="overflow-hidden">
                      <span className="block truncate text-sm font-medium">{user.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {user.email}
                      </span>
                    </span>
                  </button>
                )}
              </>
            )}
          </div>
        </aside>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {isMobile && (
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-xl">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2"
              aria-label="GlobeTrotter home"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Compass className="h-5 w-5" />
              </span>
              <span className="text-lg font-semibold tracking-tight">GlobeTrotter</span>
            </button>
            <button
              onClick={toggleTheme}
              className="touch-target flex items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
          </header>
        )}

        <main className={cn('flex-1', isMobile ? 'pb-28' : 'pb-10')}>
          <div className="mx-auto w-full max-w-6xl px-4 py-5 md:px-8 md:py-8">
            {/* Scoped inside the shell so a page crash keeps the nav usable
                and the user can simply move to another tab. */}
            <ErrorBoundary resetKey={location.pathname}>
              <PageTransition key={location.pathname}>
                <Outlet />
              </PageTransition>
            </ErrorBoundary>
          </div>
        </main>
      </div>

      {isMobile && isAuthenticated && (
        <>
          <div className="pointer-events-none fixed bottom-9 left-1/2 z-50 -translate-x-1/2">
            <div className="pointer-events-auto">
              <FloatingActionButton
                onClick={() => navigate('/trips/new')}
                label="Create new trip"
              />
            </div>
          </div>

          <motion.nav
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/90 px-4 pb-6 pt-2 backdrop-blur-xl"
            aria-label="Primary"
          >
            <div className="mx-auto flex max-w-md items-center justify-between">
              {navItems.slice(0, 2).map((item) => (
                <MobileNavLink key={item.to} {...item} />
              ))}
              {/* Reserves the space the FAB floats over. */}
              <span className="w-14" aria-hidden />
              {navItems.slice(2).map((item) => (
                <MobileNavLink key={item.to} {...item} />
              ))}
            </div>
          </motion.nav>
        </>
      )}
    </div>
  );
}

function MobileNavLink({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: typeof Home;
  label: string;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'touch-target flex flex-col items-center justify-center gap-1 rounded-xl px-2 text-[11px] font-medium transition-colors',
          isActive ? 'text-primary' : 'text-muted-foreground',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className="h-6 w-6" strokeWidth={isActive ? 2.4 : 1.8} />
          {label}
        </>
      )}
    </NavLink>
  );
}
