import { Navigate, Outlet, useLocation, useRoutes } from 'react-router-dom';
import { AuthLayout } from '@/components/layouts/AuthLayout';
import { MainLayout } from '@/components/layouts/MainLayout';
import { useAuth } from '@/hooks/use-auth';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { LoginPage } from '@/pages/LoginPage';
import { SignupPage } from '@/pages/SignupPage';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { TripsPage } from '@/pages/TripsPage';
import { CreateTripPage } from '@/pages/CreateTripPage';
import { ItineraryPage } from '@/pages/ItineraryPage';
import { ItineraryViewPage } from '@/pages/ItineraryViewPage';
import { CitySearchPage } from '@/pages/CitySearchPage';
import { ActivitySearchPage } from '@/pages/ActivitySearchPage';
import { CalendarPage } from '@/pages/CalendarPage';
import { BudgetPage } from '@/pages/BudgetPage';
import { SharedItineraryPage } from '@/pages/SharedItineraryPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { AdminDashboardPage } from '@/pages/AdminDashboardPage';

/** Shown while the session is being resolved, so routes never flash blank. */
function RouteFallback() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <LoadingSkeleton count={4} />
    </div>
  );
}

function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <RouteFallback />;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  return <Outlet />;
}

function AdminRoute() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <RouteFallback />;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  if (user?.role !== 'ADMIN') return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

/** Keeps signed-in users out of the auth screens. */
function GuestRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <RouteFallback />;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

/**
 * Entry redirect. Previously this pointed authenticated users back at "/",
 * which is this route itself — an infinite redirect loop.
 */
function IndexRedirect() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <RouteFallback />;
  return <Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />;
}

export function AppRoutes() {
  return useRoutes([
    { path: '/', element: <IndexRedirect /> },

    {
      element: <AuthLayout />,
      children: [
        {
          element: <GuestRoute />,
          children: [
            { path: '/login', element: <LoginPage /> },
            { path: '/signup', element: <SignupPage /> },
            { path: '/forgot-password', element: <ForgotPasswordPage /> },
          ],
        },
      ],
    },

    {
      element: <MainLayout />,
      children: [
        // Public share page — readable without an account.
        { path: '/public/:slug', element: <SharedItineraryPage /> },

        {
          element: <ProtectedRoute />,
          children: [
            { path: '/dashboard', element: <DashboardPage /> },
            { path: '/trips', element: <TripsPage /> },
            { path: '/trips/new', element: <CreateTripPage /> },
            { path: '/trips/:tripId', element: <ItineraryViewPage /> },
            { path: '/trips/:tripId/build', element: <ItineraryPage /> },
            { path: '/trips/:tripId/budget', element: <BudgetPage /> },
            { path: '/trips/:tripId/calendar', element: <CalendarPage /> },
            { path: '/calendar', element: <CalendarPage /> },
            { path: '/budget', element: <BudgetPage /> },
            { path: '/cities', element: <CitySearchPage /> },
            { path: '/activities', element: <ActivitySearchPage /> },
            { path: '/profile', element: <ProfilePage /> },
          ],
        },

        {
          element: <AdminRoute />,
          children: [{ path: '/admin', element: <AdminDashboardPage /> }],
        },
      ],
    },

    { path: '*', element: <Navigate to="/" replace /> },
  ]);
}
