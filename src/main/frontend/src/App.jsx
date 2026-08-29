import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppShell } from './components/layout/AppShell';
import { ToastProvider } from './components/ui';

import { JobList } from './pages/JobList';
import { JobDetail } from './pages/JobDetail';
import { Login, Register, ForgotPassword, ResetPassword } from './pages/auth';
import { MyApplications, SavedJobs, Recommendations } from './pages/seeker';
import { EmployerDashboard, ManageApplications, PostJob } from './pages/employer';
import { Home, Notifications, Profile, NotFound } from './pages/misc';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // A 401 is handled globally by the axios interceptor; retrying it is noise.
      retry: (failureCount, error) => error?.response?.status !== 401 && failureCount < 1,
    },
  },
});

/** Every route is wrapped so one page's crash cannot blank the whole app. */
const guard = (element) => <ErrorBoundary>{element}</ErrorBoundary>;

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <ToastProvider>
            <AppShell>
              <Routes>
                <Route path="/" element={guard(<Home />)} />
                <Route path="/login" element={guard(<Login />)} />
                <Route path="/register" element={guard(<Register />)} />
                <Route path="/forgot-password" element={guard(<ForgotPassword />)} />
                <Route path="/reset-password" element={guard(<ResetPassword />)} />
                <Route path="/jobs" element={guard(<JobList />)} />
                <Route path="/job/:id" element={guard(<JobDetail />)} />

                <Route path="/profile" element={<ProtectedRoute>{guard(<Profile />)}</ProtectedRoute>} />
                <Route path="/notifications" element={<ProtectedRoute>{guard(<Notifications />)}</ProtectedRoute>} />

                <Route path="/post-job" element={<ProtectedRoute requireEmployer>{guard(<PostJob />)}</ProtectedRoute>} />
                <Route path="/post-job/:id" element={<ProtectedRoute requireEmployer>{guard(<PostJob />)}</ProtectedRoute>} />
                <Route path="/employer-dashboard" element={<ProtectedRoute requireEmployer>{guard(<EmployerDashboard />)}</ProtectedRoute>} />
                <Route path="/manage-applications" element={<ProtectedRoute requireEmployer>{guard(<ManageApplications />)}</ProtectedRoute>} />

                <Route path="/my-applications" element={<ProtectedRoute requireJobSeeker>{guard(<MyApplications />)}</ProtectedRoute>} />
                <Route path="/saved-jobs" element={<ProtectedRoute requireJobSeeker>{guard(<SavedJobs />)}</ProtectedRoute>} />
                <Route path="/recommendations" element={<ProtectedRoute requireJobSeeker>{guard(<Recommendations />)}</ProtectedRoute>} />

                <Route path="*" element={guard(<NotFound />)} />
              </Routes>
            </AppShell>
          </ToastProvider>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
