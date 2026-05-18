import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { ProtectedRoute } from './components/ProtectedRoute';

// Pages
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { JobList } from './pages/JobList';
import { JobDetail } from './pages/JobDetail';
import { PostJob } from './pages/PostJob';
import { MyApplications } from './pages/MyApplications';
import { ManageApplications } from './pages/ManageApplications';
import { Profile } from './pages/Profile';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { SavedJobs } from './pages/SavedJobs';
import { AITools } from './pages/AITools';
import { EmployerDashboard } from './pages/EmployerDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { Messages } from './pages/Messages';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="app-container">
          <Navbar />
          <main className="main-content">
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/jobs" element={<JobList />} />
              <Route path="/job/:id" element={<JobDetail />} />

              {/* Authenticated Routes */}
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />

              {/* Employer Routes */}
              <Route path="/post-job" element={<ProtectedRoute requireEmployer><PostJob /></ProtectedRoute>} />
              <Route path="/manage-applications" element={<ProtectedRoute requireEmployer><ManageApplications /></ProtectedRoute>} />
              <Route path="/employer-dashboard" element={<ProtectedRoute requireEmployer><EmployerDashboard /></ProtectedRoute>} />

              {/* Job Seeker Routes */}
              <Route path="/my-applications" element={<ProtectedRoute requireJobSeeker><MyApplications /></ProtectedRoute>} />
              <Route path="/saved-jobs" element={<ProtectedRoute requireJobSeeker><SavedJobs /></ProtectedRoute>} />
              <Route path="/ai-tools" element={<ProtectedRoute requireJobSeeker><AITools /></ProtectedRoute>} />

              {/* Admin Routes */}
              <Route path="/admin" element={<ProtectedRoute requireAdmin><AdminDashboard /></ProtectedRoute>} />
            </Routes>
          </main>
          <Footer />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
