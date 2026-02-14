// client/src/pages/LandingPage.jsx — Minimal public landing page
import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Moon, Sun } from 'lucide-react';
import { dm, dt, useDarkMode } from '../utils/darkMode';
import { notifyThemeChange } from '../utils/darkMode';

const features = [
  { emoji: '🎤', label: 'AI Setup' },
  { emoji: '📅', label: 'Bookings' },
  { emoji: '💬', label: 'Inbox' },
  { emoji: '📝', label: 'Forms' },
  { emoji: '📦', label: 'Inventory' },
  { emoji: '👥', label: 'Teams' },
];

const LandingPage = () => {
  const isDark = useDarkMode();
  const { isAuthenticated, workspace, loading } = useAuth();

  const toggleTheme = () => {
    const next = !isDark;
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
    localStorage.setItem('careops_theme', next ? 'dark' : 'light');
    notifyThemeChange();
  };

  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" style={{ width: '2rem', height: '2rem' }} />
    </div>;
  }

  if (isAuthenticated) {
    return <Navigate to={workspace?.onboarding_completed ? '/dashboard' : '/onboarding'} replace />;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: dm('white'), color: dt('#0f172a'), transition: 'background 0.2s, color 0.2s' }}>

      {/* Navbar */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '1rem 2rem', maxWidth: '1100px', width: '100%', margin: '0 auto',
      }}>
        <span style={{ fontSize: '1.375rem', fontWeight: 800, color: dt('#1e1b4b'), letterSpacing: '-0.02em' }}>
          CareOps
        </span>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button onClick={toggleTheme} style={{
            background: 'none', border: `1px solid ${dm('#e2e8f0')}`, borderRadius: '0.5rem',
            padding: '0.4rem', cursor: 'pointer', color: dt('#64748b'),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }} title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <Link to="/login" style={{
            padding: '0.5rem 1.25rem', borderRadius: '0.5rem', fontSize: '0.875rem',
            fontWeight: 600, color: '#4f46e5', background: 'none', border: `1px solid ${dm('#e2e8f0')}`,
            textDecoration: 'none',
          }}>Log in</Link>
          <Link to="/register" style={{
            padding: '0.5rem 1.25rem', borderRadius: '0.5rem', fontSize: '0.875rem',
            fontWeight: 600, color: '#fff', background: '#4f46e5', border: '1px solid #4f46e5',
            textDecoration: 'none',
          }}>Get Started</Link>
        </div>
      </nav>

      {/* Hero */}
      <main style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', textAlign: 'center',
        padding: '3rem 1.5rem 4rem',
        maxWidth: '720px', margin: '0 auto', width: '100%',
      }}>
        <h1 style={{
          fontSize: 'clamp(2rem, 5vw, 3.25rem)', fontWeight: 800,
          color: dt('#0f172a'), lineHeight: 1.15, marginBottom: '1rem',
          letterSpacing: '-0.03em',
        }}>
          One Platform.<br />Zero Chaos.
        </h1>

        <p style={{
          fontSize: 'clamp(1rem, 2.5vw, 1.2rem)', color: dt('#475569'),
          lineHeight: 1.6, maxWidth: '560px', marginBottom: '2rem',
        }}>
          Bookings, leads, inbox, forms, and inventory — unified in one AI-powered dashboard for service businesses.
        </p>

        {/* CTA Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '2.5rem' }}>
          <Link to="/register" style={{
            padding: '0.75rem 2rem', borderRadius: '0.625rem', fontSize: '1rem',
            fontWeight: 700, color: '#fff', background: '#4f46e5', border: 'none',
            textDecoration: 'none',
          }}>Get Started Free</Link>
          <Link to="/login" style={{
            padding: '0.75rem 2rem', borderRadius: '0.625rem', fontSize: '1rem',
            fontWeight: 700, color: '#4f46e5', background: dm('#eef2ff'), border: 'none',
            textDecoration: 'none',
          }}>Log in</Link>
        </div>

        {/* Feature Tags */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '0.5rem',
          justifyContent: 'center',
        }}>
          {features.map(f => (
            <span key={f.label} style={{
              padding: '0.375rem 0.875rem', borderRadius: '2rem',
              background: dm('#f8fafc'), border: `1px solid ${dm('#e2e8f0')}`,
              fontSize: '0.8125rem', color: dt('#334155'), fontWeight: 500,
              whiteSpace: 'nowrap',
            }}>
              {f.emoji} {f.label}
            </span>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        textAlign: 'center', padding: '1.5rem 1rem',
        borderTop: `1px solid ${dm('#f1f5f9')}`, color: dt('#94a3b8'), fontSize: '0.8125rem',
        display: 'flex', flexDirection: 'column', gap: '0.25rem',
      }}>
        <span>Built with React, Node.js, PostgreSQL & Gemini AI</span>
        <span>CareOps © {new Date().getFullYear()}</span>
      </footer>
    </div>
  );
};

export default LandingPage;
