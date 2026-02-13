// client/src/App.jsx - Main application with routing
import { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from 'react-hot-toast';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Bookings from './pages/Bookings';
import Contacts from './pages/Contacts';
import Inbox from './pages/Inbox';
import Onboarding from './pages/Onboarding';
import BookingPage from './pages/BookingPage';
import ContactPage from './pages/ContactPage';
import TeamMembers from './pages/TeamMembers';
import Forms from './pages/Forms';
import FormPage from './pages/FormPage';
import Inventory from './pages/Inventory';
import ActivityLog from './pages/ActivityLog';
import api from './services/api';

// Cold-start overlay — shows when backend (Render free tier) is waking up
const ColdStartOverlay = () => {
  const [show, setShow] = useState(false);
  const timerRef = useRef(null);
  const doneRef = useRef(false);

  useEffect(() => {
    // Start a 5s timer; if health check hasn't responded, show overlay
    timerRef.current = setTimeout(() => {
      if (!doneRef.current) setShow(true);
    }, 5000);

    // Ping health endpoint
    const ping = async () => {
      try {
        await api.get('/health');
      } catch {
        // retry once more after 10s
        await new Promise(r => setTimeout(r, 10000));
        try { await api.get('/health'); } catch {}
      }
      doneRef.current = true;
      setShow(false);
      clearTimeout(timerRef.current);
    };
    ping();

    return () => clearTimeout(timerRef.current);
  }, []);

  if (!show) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: '1.25rem', color: 'white',
    }}>
      <div className="spinner" style={{ width: '2.5rem', height: '2.5rem', borderColor: 'rgba(255,255,255,0.2)', borderTopColor: '#818cf8' }} />
      <p style={{ fontSize: '1.125rem', fontWeight: 600 }}>Server is waking up...</p>
      <p style={{ fontSize: '0.875rem', opacity: 0.7, maxWidth: '320px', textAlign: 'center', lineHeight: 1.5 }}>
        Please wait 15-30 seconds. Free-tier servers go to sleep after inactivity.
      </p>
    </div>
  );
};

// Redirect to dashboard or onboarding based on workspace status
const HomeRedirect = () => {
  const { isAuthenticated, workspace, loading } = useAuth();

  if (loading) {
    return <div className="page-loading"><div className="spinner" style={{ width: '2rem', height: '2rem' }} /></div>;
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!workspace?.onboarding_completed) return <Navigate to="/onboarding" replace />;
  return <Navigate to="/dashboard" replace />;
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ColdStartOverlay />
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              fontSize: '0.875rem',
              borderRadius: '0.5rem'
            }
          }}
        />
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/book/:slug" element={<BookingPage />} />
          <Route path="/contact/:slug" element={<ContactPage />} />
          <Route path="/form/:formId" element={<FormPage />} />

          {/* Onboarding (protected but no layout) */}
          <Route path="/onboarding" element={
            <ProtectedRoute><Onboarding /></ProtectedRoute>
          } />

          {/* Protected routes with layout */}
          <Route path="/" element={
            <ProtectedRoute><Layout /></ProtectedRoute>
          }>
            <Route index element={<HomeRedirect />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="bookings" element={<Bookings />} />
            <Route path="contacts" element={<Contacts />} />
            <Route path="inbox" element={<Inbox />} />
            <Route path="team" element={<TeamMembers />} />
            <Route path="forms" element={<Forms />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="activity" element={<ActivityLog />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<HomeRedirect />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
