// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { lazy } from 'react';
import { createBrowserRouter } from 'react-router';
import Loadable from '../layouts/full/shared/loadable/Loadable';
import ProtectedRoute from '../components/shared/ProtectedRoute';

/* ***Layouts**** */
const FullLayout = Loadable(lazy(() => import('../layouts/full/FullLayout')));
const BlankLayout = Loadable(lazy(() => import('../layouts/blank/BlankLayout')));

// dashboards
const ModernDashboard = Loadable(lazy(() => import('../views/dashboards/modern')));

// pages
const UserProfilePage = Loadable(lazy(() => import('../views/pages/user-profile')));

// placeholder for features scheduled for later TDD phases
const UnderDevelopment = Loadable(
  lazy(() => import('../components/shared/UnderDevelopment')),
);

// authentication
const Login2 = Loadable(lazy(() => import('../views/auth/auth2/login')));
const Register2 = Loadable(lazy(() => import('../views/auth/auth2/register')));
const ForgotPassword2 = Loadable(
  lazy(() => import('../views/auth/auth2/forgot-password')),
);

// errors
const Error = Loadable(lazy(() => import('../views/auth/error')));

const Router = [
  {
    path: '/',
    element: <FullLayout />,
    children: [
      {
        path: '/',
        element: (
          <ProtectedRoute>
            <ModernDashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: '/docs',
        element: (
          <ProtectedRoute>
            <UnderDevelopment />
          </ProtectedRoute>
        ),
      },
      {
        path: '/docs/:id',
        element: (
          <ProtectedRoute>
            <UnderDevelopment />
          </ProtectedRoute>
        ),
      },
      {
        path: '/routines',
        element: (
          <ProtectedRoute>
            <UnderDevelopment />
          </ProtectedRoute>
        ),
      },
      {
        path: '/schedule',
        element: (
          <ProtectedRoute>
            <UnderDevelopment />
          </ProtectedRoute>
        ),
      },
      {
        path: '/apps',
        element: (
          <ProtectedRoute role={['manager', 'admin']}>
            <UnderDevelopment />
          </ProtectedRoute>
        ),
      },
      {
        // The per-app guard depends on `microapps.required_role`, which is not
        // available until `features/microapps` lands; require login for now.
        path: '/apps/:slug',
        element: (
          <ProtectedRoute>
            <UnderDevelopment />
          </ProtectedRoute>
        ),
      },
      {
        path: '/rh/candidates',
        element: (
          <ProtectedRoute role={['rh', 'admin']}>
            <UnderDevelopment />
          </ProtectedRoute>
        ),
      },
      {
        path: '/rh/candidates/:id',
        element: (
          <ProtectedRoute role={['rh', 'admin']}>
            <UnderDevelopment />
          </ProtectedRoute>
        ),
      },
      {
        path: '/profile',
        element: (
          <ProtectedRoute>
            <UserProfilePage />
          </ProtectedRoute>
        ),
      },
    ],
  },
  {
    path: '/',
    element: <BlankLayout />,
    children: [
      { path: '/login', element: <Login2 /> },
      // Boilerplate aliases kept so links inside the auth views still resolve.
      { path: '/auth/auth2/login', element: <Login2 /> },
      { path: '/auth/auth2/register', element: <Register2 /> },
      { path: '/auth/auth2/forgot-password', element: <ForgotPassword2 /> },
    ],
  },
  { path: '*', element: <Error /> },
];

const router = createBrowserRouter(Router);

export default router;
