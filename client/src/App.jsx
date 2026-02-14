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
import LandingPage from './pages/LandingPage';
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
      padding: '1.5rem',
    }}>
      <div className="spinner" style={{ width: '2.5rem', height: '2.5rem', borderColor: 'rgba(255,255,255,0.2)', borderTopColor: '#818cf8' }} />
      <p style={{ fontSize: 'clamp(1rem, 4vw, 1.125rem)', fontWeight: 600, textAlign: 'center' }}>Server is waking up...</p>
      <p style={{ fontSize: 'clamp(0.8125rem, 3.5vw, 0.875rem)', opacity: 0.7, maxWidth: '320px', textAlign: 'center', lineHeight: 1.5 }}>
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

  if (!isAuthenticated) return <Navigate to="/landing" replace />;
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
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/book/:slug" element={<BookingPage />} />
          <Route path="/contact/:slug" element={<ContactPage />} />
          <Route path="/form/:formId" element={<FormPage />} />

          {/* Onboarding (protected but no layout) */}
          <Route path="/onboarding" element={
            <ProtectedRoute><Onboarding /></ProtectedRoute>
          } />

          {/* Root — landing or dashboard based on auth */}
          <Route path="/" element={<HomeRedirect />} />

          {/* Protected routes with layout */}
          <Route element={
            <ProtectedRoute><Layout /></ProtectedRoute>
          }>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="bookings" element={
              <ProtectedRoute requiredPermission="bookings"><Bookings /></ProtectedRoute>
            } />
            <Route path="contacts" element={
              <ProtectedRoute requiredPermission="contacts"><Contacts /></ProtectedRoute>
            } />
            <Route path="inbox" element={
              <ProtectedRoute requiredPermission="inbox"><Inbox /></ProtectedRoute>
            } />
            <Route path="team" element={
              <ProtectedRoute adminOnly><TeamMembers /></ProtectedRoute>
            } />
            <Route path="forms" element={
              <ProtectedRoute requiredPermission="forms"><Forms /></ProtectedRoute>
            } />
            <Route path="inventory" element={
              <ProtectedRoute requiredPermission="inventory"><Inventory /></ProtectedRoute>
            } />
            <Route path="activity" element={
              <ProtectedRoute requiredPermission="activity"><ActivityLog /></ProtectedRoute>
            } />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<HomeRedirect />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
