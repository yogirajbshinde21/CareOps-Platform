// client/src/components/Layout.jsx - Responsive app shell with sidebar
import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, Calendar, MessageSquare, Users, 
  Settings, LogOut, Menu, X, Briefcase, ChevronDown, UsersRound, FileText, Package, Clock, Moon, Sun
} from 'lucide-react';
import { notifyThemeChange } from '../utils/darkMode';

const navItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/bookings', icon: Calendar, label: 'Bookings' },
  { path: '/inbox', icon: MessageSquare, label: 'Inbox' },
  { path: '/contacts', icon: Users, label: 'Contacts' },
  { path: '/team', icon: UsersRound, label: 'Team' },
  { path: '/forms', icon: FileText, label: 'Forms' },
  { path: '/inventory', icon: Package, label: 'Inventory' },
  { path: '/activity', icon: Clock, label: 'Activity Log' },
];

const Layout = () => {
  const { user, workspace, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('careops_theme') === 'dark';
  });

  // Apply dark mode
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('careops_theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const toggleDarkMode = () => {
    const next = !darkMode;
    // Set DOM attribute synchronously so dm() reads correct value during next render
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
    localStorage.setItem('careops_theme', next ? 'dark' : 'light');
    setDarkMode(next);
    notifyThemeChange();
  };

  // Close sidebar on route change (mobile)
  const pathname = location.pathname;
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="layout-root">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        {/* Logo + Close */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">C</div>
          <span className="sidebar-logo-text">CareOps</span>
          <button className="sidebar-close-btn" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`}
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Dark mode toggle */}
        <div style={{ padding: '0.5rem 0.75rem' }}>
          <button
            onClick={toggleDarkMode}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              width: '100%', padding: '0.625rem 0.875rem', borderRadius: '0.5rem',
              background: 'rgba(255,255,255,0.08)', border: 'none',
              color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
              fontSize: '0.8125rem', fontWeight: 400, transition: 'all 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
          >
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
            {darkMode ? 'Light Mode' : 'Dark Mode'}
          </button>
        </div>

        {/* User section */}
        <div className="sidebar-user">
          <div className="sidebar-user-info">
            <div className="sidebar-user-avatar">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="sidebar-user-details">
              <div className="sidebar-user-name">{user?.name}</div>
              <div className="sidebar-user-workspace">{workspace?.name}</div>
            </div>
          </div>
          <button onClick={handleLogout} className="sidebar-logout">
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content">
        {/* Top bar */}
        <header className="topbar">
          <button className="topbar-menu-btn" onClick={() => setSidebarOpen(true)}>
            <Menu size={22} />
          </button>
          <div style={{ flex: 1 }} />
          <div className="topbar-workspace">
            <Briefcase size={15} />
            <span className="topbar-workspace-name">{workspace?.name}</span>
          </div>
        </header>

        {/* Page content */}
        <div className="page-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
